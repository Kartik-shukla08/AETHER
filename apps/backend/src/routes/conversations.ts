import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export default async function conversationsRoutes(
  fastify: FastifyInstance,
  options: { prisma: PrismaClient }
) {
  const { prisma } = options;

  // GET /conversations - Fetch list of active threads
  fastify.get('/conversations', async (request, reply) => {
    try {
      const conversations = await prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
      });
      return conversations;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to retrieve conversations' });
    }
  });

  // GET /conversations/:id - Fetch messages in a thread
  fastify.get('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' });
      }

      return conversation;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to retrieve conversation details' });
    }
  });

  // POST /conversations - Create new conversation thread
  fastify.post('/conversations', async (request, reply) => {
    const bodySchema = z.object({
      title: z.string().min(1),
    });

    const validation = bodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: validation.error.format(),
      });
    }

    try {
      const conversation = await prisma.conversation.create({
        data: {
          title: validation.data.title,
        },
      });
      return conversation;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to create conversation' });
    }
  });

  // DELETE /conversations/:id - Clear/Delete a conversation thread
  fastify.delete('/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.conversation.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(404).send({ error: 'Conversation not found or already deleted' });
    }
  });
}
