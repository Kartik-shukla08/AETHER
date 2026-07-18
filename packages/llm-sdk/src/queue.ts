import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let queue: Queue | null = null;
let redisConnection: IORedis | null = null;

function getQueue(): Queue {
  if (!queue) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    // bullmq requires maxRetriesPerRequest to be null
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    
    // We instantiate the Queue client
    queue = new Queue('inference_events', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }
  return queue;
}

export interface PublishLogPayload {
  conversationId: string;
  provider: string;
  model: string;
  latencyMs: number;
  ttftMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestPreview: string;
  responsePreview: string;
  status: 'success' | 'error';
  errorMessage?: string | null;
}

export async function publishInferenceEvent(payload: PublishLogPayload): Promise<void> {
  try {
    const q = getQueue();
    await q.add('inference_log', payload);
  } catch (error) {
    console.error('[LLM-SDK-QUEUE] Failed to publish inference event to Redis queue:', error);
  }
}

// Graceful cleanup
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
