import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import { sendScheduledEmail } from '../services/email.service.js';
import { logger } from '../utils/logger.js';
import { EMAIL_QUEUE_NAME } from '../queue/email.queue.js';

export const emailWorker = new Worker(
  EMAIL_QUEUE_NAME,
  async (job: Job<{ emailId: string }>, token?: string) => {
    const { emailId } = job.data;
    logger.info(`Worker processing job ${job.id} for email ID ${emailId}`);
    
    // Call refactored central email dispatch service method with token and job parameters
    await sendScheduledEmail(emailId, token, job);
  },
  {
    connection: redisConfig,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
  }
);

// Worker error listeners
emailWorker.on('failed', (job, err) => {
  logger.error(`Worker job ${job?.id} failed finally:`, err);
});

emailWorker.on('error', (err) => {
  logger.error('Worker global runtime error:', err);
});
