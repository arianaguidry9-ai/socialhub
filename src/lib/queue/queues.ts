import { Queue, Worker, type Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

/** BullMQ queue names. */
export const QUEUE_NAMES = {
  POST_PUBLISH: 'post:publish',
  METRICS_FETCH: 'metrics:fetch',
  TOKEN_REFRESH: 'token:refresh',
  EMAIL_NOTIFY: 'email:notify',
} as const;

/** Default queue connection config. */
const connection = { connection: redis };

/** Post publishing queue — processes scheduled posts. */
export const postPublishQueue = new Queue(QUEUE_NAMES.POST_PUBLISH, {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/** Metrics fetching queue — fetches engagement metrics periodically. */
export const metricsFetchQueue = new Queue(QUEUE_NAMES.METRICS_FETCH, {
  ...connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

/** Token refresh queue — refreshes expiring OAuth tokens. */
export const tokenRefreshQueue = new Queue(QUEUE_NAMES.TOKEN_REFRESH, {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

/** Email notification queue. */
export const emailNotifyQueue = new Queue(QUEUE_NAMES.EMAIL_NOTIFY, {
  ...connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

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
