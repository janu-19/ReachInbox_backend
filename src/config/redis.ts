import Redis from 'ioredis';
import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const isSecure = redisUrl.protocol === 'rediss:';

export const redisConfig: ConnectionOptions = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port) || 6379,
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ connection guidelines
  ...(isSecure ? { tls: { rejectUnauthorized: false } } : {}),
};

export const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  ...(isSecure ? { tls: { rejectUnauthorized: false } } : {}),
});

redisClient.on('error', (err) => {
  console.error('Redis Client Connection Error:', err);
});

