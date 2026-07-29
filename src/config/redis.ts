import Redis from 'ioredis';
import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

const rawRedisUrl = process.env.REDIS_URL;

let host = '127.0.0.1';
let port = 6379;
let username: string | undefined;
let password: string | undefined;
let isSecure = false;

if (rawRedisUrl) {
  try {
    const redisUrl = new URL(rawRedisUrl);
    host = redisUrl.hostname;
    port = parseInt(redisUrl.port) || 6379;
    username = redisUrl.username || undefined;
    password = redisUrl.password || undefined;
    isSecure = redisUrl.protocol === 'rediss:';
  } catch (err: any) {
    logger.error('Invalid REDIS_URL string in environment variables', err);
  }
}

export const redisConfig: ConnectionOptions = {
  host,
  port,
  username,
  password,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false, // Prevents HTTP endpoints from hanging if Redis is temporarily unreachable
  ...(isSecure ? { tls: { rejectUnauthorized: false } } : {}),
};

export const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  ...(isSecure ? { tls: { rejectUnauthorized: false } } : {}),
});

redisClient.on('connect', () => {
  logger.info(`Redis socket connecting to ${host}:${port}...`);
});

redisClient.on('ready', () => {
  logger.info(`Redis client is READY and authenticated at ${host}:${port}`);
});

redisClient.on('error', (err) => {
  logger.warn(`Redis Client Warning (${host}:${port}): ${err.message}`);
});

redisClient.on('close', () => {
  logger.info('Redis connection closed.');
});

