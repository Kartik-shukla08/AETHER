import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { chat, chatStream } from '@llm-logging/llm-sdk';

// Map to track active streams for cancellation
const activeStreams = new Map<string, () => void>();

export default async function chatRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;

  // DELETE /chat/cancel - Cancel active generation
  fastify.delete('/chat/cancel', async (request, reply) => {
    const { conversationId } = (request.body || request.query || {}) as { conversationId?: string };

    if (!conversationId) {
      return reply.status(400).send({ error: 'conversationId is required' });
    }

    const cancel = activeStreams.get(conversationId);
    if (cancel) {
      cancel();
      return { success: true, message: 'Generation cancelled' };
    }
    return { success: false, message: 'No active generation found' };
  });

  fastify.post('/chat', async (request, reply) => {
    const bodySchema = z.object({
      conversationId: z.string().uuid(),
      provider: z.enum(['openai', 'gemini', 'groq', 'grok', 'openrouter']),
      model: z.string().min(1),
      messages: z.array(
        z.object({
          role: z.string(),
          content: z.string(),
        })
      ),
      stream: z.boolean().optional().default(false),
    });

    const validation = bodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: validation.error.format(),
      });
    }

    const { conversationId, provider, model, messages, stream } = validation.data;

    // Verify conversation exists
    const conversationExists = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversationExists) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    // Resolve API key
    const headers = request.headers as Record<string, string>;
    let apiKey = '';
    if (provider === 'openai') {
      apiKey = headers['x-openai-key'] || process.env.OPENAI_API_KEY || '';
    } else if (provider === 'gemini') {
      apiKey = headers['x-gemini-key'] || process.env.GEMINI_API_KEY || '';
    } else if (provider === 'groq') {
      apiKey = headers['x-groq-key'] || process.env.GROQ_API_KEY || '';
    } else if (provider === 'grok') {
      apiKey = headers['x-grok-key'] || process.env.GROK_API_KEY || '';
    } else if (provider === 'openrouter') {
      apiKey = headers['x-openrouter-key'] || process.env.OPENROUTER_API_KEY || '';
    }

    if (!apiKey) {
      return reply.status(400).send({
        error: `Missing API Key for provider: ${provider}. Please set it in the Settings panel or environment.`,
      });
    }

    // Persist the user's prompt (the last message in the input list)
    const userMsg = messages[messages.length - 1];
    if (userMsg && userMsg.role === 'user') {
      await prisma.message.create({
        data: {
          conversationId,
          role: 'user',
          content: userMsg.content,
          provider,
        },
      });
      // Touch parent conversation to update its updatedAt timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    if (stream) {
      // Setup Server-Sent Events headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      let isCancelled = false;
      const cancelFn = () => {
        isCancelled = true;
      };
      activeStreams.set(conversationId, cancelFn);

      // Handle socket close from client side
      request.raw.on('close', () => {
        cancelFn();
      });

      try {
        const { stream: chunkStream, metricsPromise } = await chatStream({
          provider,
          model,
          messages,
          apiKey,
          conversationId,
        });

        // Pipe chunks to raw response
        for await (const chunk of chunkStream) {
          if (isCancelled) {
            break;
          }
          reply.raw.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }

        if (isCancelled) {
          fastify.log.info(`Stream for conversation ${conversationId} was cancelled`);
          reply.raw.write(`data: ${JSON.stringify({ text: ' [Generation Cancelled]' })}\n\n`);
          reply.raw.write(`data: [DONE]\n\n`);
          reply.raw.end();
          return reply;
        }

        // Wait for final metrics and content
        const finalResponse = await metricsPromise;

        // Persist assistant message
        await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: finalResponse.content,
            provider,
          },
        });

        // Touch parent conversation to update its updatedAt timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Trigger log storage (Phase 4 placeholder/integration)
        fastify.log.info(
          { metrics: finalResponse.metrics },
          'Inference completed and metrics collected'
        );

        // Terminate stream cleanly
        reply.raw.write(`data: [DONE]\n\n`);
        reply.raw.end();
      } catch (err: any) {
        fastify.log.error(err);
        reply.raw.write(`data: ${JSON.stringify({ error: err.message || 'Stream error occurred' })}\n\n`);
        reply.raw.end();
      } finally {
        activeStreams.delete(conversationId);
      }

      // Fastify handles ending the response when raw is terminated
      return reply;
    } else {
      try {
        const finalResponse = await chat({
          provider,
          model,
          messages,
          apiKey,
          conversationId,
        });

        // Persist assistant message
        await prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: finalResponse.content,
            provider,
          },
        });

        // Touch parent conversation to update its updatedAt timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Log metrics (Phase 4 placeholder/integration)
        fastify.log.info(
          { metrics: finalResponse.metrics },
          'Inference completed and metrics collected'
        );

        return {
          content: finalResponse.content,
          metrics: finalResponse.metrics,
        };
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          error: err.message || 'An error occurred during chat completion',
        });
      }
    }
  });
}
