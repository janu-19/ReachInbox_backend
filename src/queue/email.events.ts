import { QueueEvents } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import { EMAIL_QUEUE_NAME } from './email.queue.js';
import { logger } from '../utils/logger.js';

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
});

emailQueueEvents.on('waiting', ({ jobId }) => {
  logger.info(`Job ${jobId} is waiting in the queue.`);
});

emailQueueEvents.on('active', ({ jobId, prev }) => {
  logger.info(`Job ${jobId} is now active (previous state: ${prev}).`);
});

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.info(`Job ${jobId} completed successfully.`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`Job ${jobId} failed with reason: ${failedReason}`);
});
