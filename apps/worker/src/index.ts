import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

// Load env variables
dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const INGESTION_URL = process.env.INGESTION_URL || 'http://localhost:4010/logs';

console.log(`[Worker] Initializing...`);
console.log(`[Worker] Connecting to Redis at ${REDIS_URL}`);
console.log(`[Worker] Forwarding events to Ingestion API at ${INGESTION_URL}`);

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

redisConnection.on('connect', () => {
  console.log('[Worker] Connected to Redis successfully');
});

redisConnection.on('error', (err) => {
  console.error('[Worker] Redis connection error:', err);
});

// Setup the worker
const worker = new Worker(
  'inference_events',
  async (job: Job) => {
    console.log(`[Worker] Processing job ${job.id} of type ${job.name}`);
    
    try {
      const response = await fetch(INGESTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(job.data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ingestion service returned status ${response.status}: ${errorText}`
        );
      }

      const result = await response.json();
      console.log(`[Worker] Job ${job.id} processed successfully:`, result);
      return result;
    } catch (error: any) {
      console.error(`[Worker] Job ${job.id} failed:`, error.message);
      // Re-throw so BullMQ triggers retry logic
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
});

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log('[Worker] Shutting down worker gracefully...');
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
