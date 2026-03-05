import { Queue, type ConnectionOptions } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

/** BullMQ queue names. */
export const QUEUE_NAMES = {
  POST_PUBLISH: 'post-publish',
  METRICS_FETCH: 'metrics-fetch',
  TOKEN_REFRESH: 'token-refresh',
  EMAIL_NOTIFY: 'email-notify',
} as const;

/** Default queue connection config (lazy). */
function getConnection() {
  return { connection: redis as unknown as ConnectionOptions };
}

/** Lazy queue singleton cache. */
const queues: Record<string, Queue> = {};

function getQueue(name: string, opts: Record<string, unknown> = {}): Queue {
  if (!queues[name]) {
    queues[name] = new Queue(name, { ...getConnection(), ...opts });
  }
  return queues[name];
}

/** Post publishing queue — processes scheduled posts. */
export const postPublishQueue = {
  get queue() {
    return getQueue(QUEUE_NAMES.POST_PUBLISH, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  },
  add: (...args: Parameters<Queue['add']>) => postPublishQueue.queue.add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => postPublishQueue.queue.getJob(...args),
};

/** Metrics fetching queue — fetches engagement metrics periodically. */
export const metricsFetchQueue = {
  get queue() {
    return getQueue(QUEUE_NAMES.METRICS_FETCH, {
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
  },
  add: (...args: Parameters<Queue['add']>) => metricsFetchQueue.queue.add(...args),
};

/** Token refresh queue — refreshes expiring OAuth tokens. */
export const tokenRefreshQueue = {
  get queue() {
    return getQueue(QUEUE_NAMES.TOKEN_REFRESH, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  },
  add: (...args: Parameters<Queue['add']>) => tokenRefreshQueue.queue.add(...args),
};

/** Email notification queue. */
export const emailNotifyQueue = {
  get queue() {
    return getQueue(QUEUE_NAMES.EMAIL_NOTIFY, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    });
  },
  add: (...args: Parameters<Queue['add']>) => emailNotifyQueue.queue.add(...args),
};

/**
 * Schedule a post for publishing at a future time.
 */
export async function schedulePost(postTargetId: string, scheduledAt: Date, isPremium: boolean) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  const priority = isPremium ? 1 : 10; // Premium users get priority

  await postPublishQueue.add(
    'publish',
    { postTargetId },
    { delay, priority, jobId: `publish:${postTargetId}` }
  );

  logger.info({ postTargetId, scheduledAt, delay }, 'Post scheduled in queue');
}

/**
 * Remove a scheduled post from the queue.
 */
export async function unschedulePost(postTargetId: string) {
  const job = await postPublishQueue.getJob(`publish:${postTargetId}`);
  if (job) {
    await job.remove();
    logger.info({ postTargetId }, 'Post removed from queue');
  }
}

/**
 * Schedule metrics fetching for a published post.
 * Fetches at 1h, 6h, 24h, 48h, 7d intervals.
 */
export async function scheduleMetricsFetch(postTargetId: string) {
  const intervals = [
    60 * 60 * 1000,         // 1 hour
    6 * 60 * 60 * 1000,     // 6 hours
    24 * 60 * 60 * 1000,    // 24 hours
    48 * 60 * 60 * 1000,    // 48 hours
    7 * 24 * 60 * 60 * 1000, // 7 days
  ];

  for (const delay of intervals) {
    await metricsFetchQueue.add(
      'fetch',
      { postTargetId },
      { delay, jobId: `metrics:${postTargetId}:${delay}` }
    );
  }
}
