import fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import conversationsRoutes from './routes/conversations.js';
import chatRoutes from './routes/chat.js';

// Load environment variables
dotenv.config();

const server = fastify({
  logger: true,
});

const prisma = new PrismaClient();

// Register CORS
server.register(cors, {
  origin: true, // Allow all origins for dev
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Root check endpoint
server.get('/', async () => {
  return { status: 'ok', service: 'backend-api' };
});

// Health check endpoint
server.get('/health', async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', database: 'connected' };
  } catch (error) {
    return { status: 'unhealthy', database: 'disconnected' };
  }
});

// Register routes
server.register(conversationsRoutes, { prisma });
server.register(chatRoutes, { prisma });

// Start Fastify server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await prisma.$connect();
    server.log.info('Database connected successfully');

    await server.listen({ port, host });
    server.log.info(`Backend server listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async () => {
  server.log.info('Shutting down server gracefully...');
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

start();
