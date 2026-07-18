import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import dotenv from 'dotenv';
import { redact } from './redact.js';

dotenv.config();

const server = fastify({
  logger: true,
});

const prisma = new PrismaClient();

// Register CORS
server.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Register WebSockets
server.register(fastifyWebsocket);

const clients = new Set<any>();

function broadcast(data: any) {
  server.log.info(`Broadcasting telemetry update to ${clients.size} clients`);
  for (const client of clients) {
    try {
      if (client.socket.readyState === 1) { // OPEN
        client.socket.send(JSON.stringify(data));
      }
    } catch (err) {
      server.log.error(err, 'Failed to send websocket message');
    }
  }
}

// Zod schema for inbound JSON telemetry log payload
const logPayloadSchema = z.object({
  conversationId: z.string().uuid(),
  provider: z.string().min(1),
  model: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
  ttftMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  requestPreview: z.string(),
  responsePreview: z.string(),
  status: z.enum(['success', 'error']),
  errorMessage: z.string().nullable().optional(),
});

/**
 * Calculates aggregated metrics from postgres
 */
async function getAggregatedMetrics(prismaClient: PrismaClient) {
  const totalRequests = await prismaClient.inferenceLog.count();
  if (totalRequests === 0) {
    return {
      totalRequests: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      successRate: 0,
      errorRate: 0,
      tokenConsumption: { input: 0, output: 0, total: 0 },
      providerSplits: {},
      recentLogs: [],
    };
  }

  const avgLatency = await prismaClient.inferenceLog.aggregate({
    _avg: { latencyMs: true },
  });

  const successCount = await prismaClient.inferenceLog.count({
    where: { status: 'success' },
  });

  const errorCount = await prismaClient.inferenceLog.count({
    where: { status: 'error' },
  });

  const tokenSums = await prismaClient.inferenceLog.aggregate({
    _sum: {
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
    },
  });

  const providersGroup = await prismaClient.inferenceLog.groupBy({
    by: ['provider'],
    _count: {
      _all: true,
    },
  });

  // P95 latency using raw PostgreSQL percentile_cont
  const p95Result = await prismaClient.$queryRaw<Array<{ p95: number }>>`
    SELECT COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95
    FROM inference_logs
  `;
  const p95LatencyMs = p95Result[0]?.p95 || 0;

  const providerSplits: Record<string, number> = {};
  for (const group of providersGroup) {
    providerSplits[group.provider] = group._count._all;
  }

  const recentLogs = await prismaClient.inferenceLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    totalRequests,
    avgLatencyMs: avgLatency._avg.latencyMs || 0,
    p95LatencyMs,
    successRate: (successCount / totalRequests) * 100,
    errorRate: (errorCount / totalRequests) * 100,
    tokenConsumption: {
      input: tokenSums._sum.inputTokens || 0,
      output: tokenSums._sum.outputTokens || 0,
      total: tokenSums._sum.totalTokens || 0,
    },
    providerSplits,
    recentLogs,
  };
}

// WebSocket Route
server.register(async (fastifyInstance) => {
  fastifyInstance.get('/ws', { websocket: true }, (connection, req) => {
    clients.add(connection);
    server.log.info('New WebSocket connection established');

    connection.socket.send(
      JSON.stringify({ type: 'connected', message: 'Connected to live LLM log events stream.' })
    );

    // Push initial aggregated metrics immediately upon connection
    getAggregatedMetrics(prisma)
      .then((metrics) => {
        connection.socket.send(JSON.stringify({ type: 'metrics', data: metrics }));
      })
      .catch((err) => {
        server.log.error(err, 'Failed to fetch metrics for new websocket connection');
      });

    connection.socket.on('close', () => {
      clients.delete(connection);
      server.log.info('WebSocket connection closed');
    });

    connection.socket.on('error', (err: any) => {
      clients.delete(connection);
      server.log.error(err, 'WebSocket error occurred');
    });
  });
});

// REST: Health Check
server.get('/health', async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', database: 'connected' };
  } catch (error) {
    return { status: 'unhealthy', database: 'disconnected' };
  }
});

// REST: Ingestion Endpoint
server.post('/logs', async (request, reply) => {
  const validation = logPayloadSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({
      error: 'Invalid telemetry payload structure',
      details: validation.error.format(),
    });
  }

  const payload = validation.data;

  try {
    // Redact PII from text fields before writing to database
    const redactedRequestPreview = redact(payload.requestPreview);
    const redactedResponsePreview = redact(payload.responsePreview);
    const redactedErrorMessage = payload.errorMessage ? redact(payload.errorMessage) : null;

    // Persist to Postgres
    const savedLog = await prisma.inferenceLog.create({
      data: {
        conversationId: payload.conversationId,
        provider: payload.provider,
        model: payload.model,
        latencyMs: payload.latencyMs,
        ttftMs: payload.ttftMs,
        inputTokens: payload.inputTokens,
        outputTokens: payload.outputTokens,
        totalTokens: payload.totalTokens,
        requestPreview: redactedRequestPreview,
        responsePreview: redactedResponsePreview,
        status: payload.status,
        errorMessage: redactedErrorMessage,
      },
    });

    // Query latest aggregates
    const metrics = await getAggregatedMetrics(prisma);

    // Broadcast live update
    broadcast({
      type: 'log',
      log: savedLog,
      metrics,
    });

    return reply.status(201).send({
      success: true,
      logId: savedLog.id,
    });
  } catch (error: any) {
    server.log.error(error);
    return reply.status(500).send({
      error: error.message || 'Failed to ingest log telemetry data',
    });
  }
});

// REST: Get Metrics API
server.get('/metrics', async (request, reply) => {
  try {
    const metrics = await getAggregatedMetrics(prisma);
    return metrics;
  } catch (error: any) {
    server.log.error(error);
    return reply.status(500).send({
      error: error.message || 'Failed to calculate dashboard metrics',
    });
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT_INGESTION || process.env.PORT || '4010', 10);
    const host = process.env.HOST || '0.0.0.0';

    await prisma.$connect();
    server.log.info('Ingestion DB connection successful');

    await server.listen({ port, host });
    server.log.info(`Telemetry Ingestion service running at http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

const gracefulShutdown = async () => {
  server.log.info('Shutting down ingestion server...');
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

start();
