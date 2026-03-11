import { jobsRef, generateId } from '@/lib/db';
import { logger } from '@/lib/logger';

/** Queue names. */
export const QUEUE_NAMES = {
  POST_PUBLISH: 'post-publish',
  METRICS_FETCH: 'metrics-fetch',
  TOKEN_REFRESH: 'token-refresh',
  EMAIL_NOTIFY: 'email-notify',
} as const;

interface JobOptions {
  delay?: number;
  priority?: number;
  jobId?: string;
  attempts?: number;
}

/** Add a job to the Firestore-based queue. */
async function addJob(queue: string, name: string, data: Record<string, any>, opts: JobOptions = {}) {
  const id = opts.jobId || generateId();
  const processAfter = new Date(Date.now() + (opts.delay || 0));

  await jobsRef.doc(id).set({
    queue,
    name,
    data,
    status: 'pending',
    priority: opts.priority ?? 10,
    attempts: 0,
    maxAttempts: opts.attempts ?? 3,
    error: null,
    processAfter,
    createdAt: new Date(),
    completedAt: null,
  });

  logger.info({ queue, name, id, processAfter }, 'Job added to queue');
  return id;
}

/** Remove a job from the queue. */
async function removeJob(jobId: string) {
  const doc = jobsRef.doc(jobId);
  const snap = await doc.get();
  if (snap.exists) {
    await doc.delete();
    logger.info({ jobId }, 'Job removed from queue');
  }
}

/** Post publishing queue. */
export const postPublishQueue = {
  add: (name: string, data: Record<string, any>, opts?: JobOptions) =>
    addJob(QUEUE_NAMES.POST_PUBLISH, name, data, { attempts: 3, ...opts }),
  getJob: async (jobId: string) => {
    const snap = await jobsRef.doc(jobId).get();
    return snap.exists ? { id: snap.id, ...snap.data(), remove: () => removeJob(snap.id) } : null;
  },
};

/** Metrics fetching queue. */
export const metricsFetchQueue = {
  add: (name: string, data: Record<string, any>, opts?: JobOptions) =>
    addJob(QUEUE_NAMES.METRICS_FETCH, name, data, { attempts: 2, ...opts }),
};

/** Token refresh queue. */
export const tokenRefreshQueue = {
  add: (name: string, data: Record<string, any>, opts?: JobOptions) =>
    addJob(QUEUE_NAMES.TOKEN_REFRESH, name, data, { attempts: 3, ...opts }),
};

/** Email notification queue. */
export const emailNotifyQueue = {
  add: (name: string, data: Record<string, any>, opts?: JobOptions) =>
    addJob(QUEUE_NAMES.EMAIL_NOTIFY, name, data, { attempts: 3, ...opts }),
};

/**
 * Schedule a post for publishing at a future time.
 */
export async function schedulePost(postTargetId: string, scheduledAt: Date, isPremium: boolean) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  const priority = isPremium ? 1 : 10;

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
    await removeJob(job.id);
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
