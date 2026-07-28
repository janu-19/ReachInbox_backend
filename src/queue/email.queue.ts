import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis.js';

export const EMAIL_QUEUE_NAME = 'email-dispatch-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Automatically retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000, // Exponential backoff starting at 5s (5s, 10s, 20s...)
    },
    removeOnComplete: true, // Auto clean completed jobs from Redis to preserve memory
    removeOnFail: false, // Keep failed jobs registered so we can audit failures
  },
});
