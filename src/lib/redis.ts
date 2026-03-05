import Redis from 'ioredis';
import { logger } from './logger';

const globalForRedis = globalThis as unknown as { redis: Redis };

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is required');
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  client.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
