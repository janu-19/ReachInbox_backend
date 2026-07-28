import Redis from 'ioredis';
import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export const redisConfig: ConnectionOptions = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ connection guidelines
};

export const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});
