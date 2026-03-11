import {
  jobsRef,
  postTargetsRef,
  postsRef,
  socialAccountsRef,
  postMetricsRef,
  usersRef,
  generateId,
} from '@/lib/db';
import { getConnector } from '@/lib/connectors';
import { decrypt, encrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES, scheduleMetricsFetch, emailNotifyQueue } from './queues';
import type { PlatformTokens, PostContent } from '@/types';

const POLL_INTERVAL = 5000; // 5 seconds

/** Process a single post-publish job. */
async function processPublishJob(data: { postTargetId: string }) {
  const { postTargetId } = data;

  const targetSnap = await postTargetsRef.doc(postTargetId).get();
  const target = targetSnap.data();
  if (!target) throw new Error(`PostTarget ${postTargetId} not found`);

  const postSnap = await postsRef.doc(target.postId).get();
  const post = postSnap.data();
  if (!post) throw new Error(`Post ${target.postId} not found`);

  const saSnap = await socialAccountsRef.doc(target.socialAccountId).get();
  const socialAccount = saSnap.data();
  if (!socialAccount) throw new Error(`SocialAccount ${target.socialAccountId} not found`);

  await postTargetsRef.doc(postTargetId).update({ status: 'POSTING' });

  const tokens: PlatformTokens = {
    accessToken: decrypt(socialAccount.accessToken),
    refreshToken: socialAccount.refreshToken ? decrypt(socialAccount.refreshToken) : undefined,
    expiresAt: socialAccount.tokenExpiresAt?.toDate?.() ?? socialAccount.tokenExpiresAt ?? undefined,
  };

  if (tokens.expiresAt && tokens.expiresAt < new Date()) {
    logger.info({ postTargetId }, 'Refreshing expired token before publish');
    const connector = getConnector(target.platform.toLowerCase());
    const newTokens = await connector.refreshAccessToken(tokens);
    await socialAccountsRef.doc(target.socialAccountId).update({
      accessToken: encrypt(newTokens.accessToken),
      refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : null,
      tokenExpiresAt: newTokens.expiresAt || null,
    });
    tokens.accessToken = newTokens.accessToken;
  }

  const content: PostContent = {
    text: post.content || undefined,
    title: post.title || undefined,
    mediaUrls: post.mediaUrls || [],
    link: post.link || undefined,
    subreddit: target.subreddit || undefined,
    flair: target.flair || undefined,
  };

  const connector = getConnector(target.platform.toLowerCase());
  const result = await connector.publish(tokens, content);

  if (result.success) {
    await postTargetsRef.doc(postTargetId).update({
      status: 'PUBLISHED',
      platformPostId: result.platformPostId || null,
      publishedUrl: result.publishedUrl || null,
    });

    const allTargetsSnap = await postTargetsRef.where('postId', '==', target.postId).get();
    const allPublished = allTargetsSnap.docs.every((d) => d.data().status === 'PUBLISHED');
    if (allPublished) {
      await postsRef.doc(target.postId).update({ status: 'PUBLISHED', publishedAt: new Date() });
    }

    if (result.platformPostId) {
      await scheduleMetricsFetch(postTargetId);
    }

    logger.info({ postTargetId, platformPostId: result.platformPostId }, 'Post published successfully');
  } else {
    throw new Error(result.error || 'Unknown publish error');
  }
}

/** Process a single metrics-fetch job. */
async function processMetricsFetchJob(data: { postTargetId: string }) {
  const { postTargetId } = data;
  logger.info({ postTargetId }, 'Fetching metrics');

  const targetSnap = await postTargetsRef.doc(postTargetId).get();
  const target = targetSnap.data();
  if (!target?.platformPostId) {
    logger.warn({ postTargetId }, 'No platform post ID, skipping metrics');
    return;
  }

  const saSnap = await socialAccountsRef.doc(target.socialAccountId).get();
  const sa = saSnap.data()!;

  const tokens: PlatformTokens = {
    accessToken: decrypt(sa.accessToken),
    refreshToken: sa.refreshToken ? decrypt(sa.refreshToken) : undefined,
  };

  const connector = getConnector(target.platform.toLowerCase());
  const metrics = await connector.fetchMetrics(tokens, target.platformPostId);

  await postMetricsRef.doc(generateId()).set({
    postTargetId,
    fetchedAt: new Date(),
    impressions: metrics.impressions,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    saves: metrics.saves,
    clicks: metrics.clicks,
    reach: 0,
    raw: null,
  });

  logger.info({ postTargetId, metrics }, 'Metrics fetched and stored');
}

/** Process a single email-notify job. */
async function processEmailNotifyJob(data: { userId: string; postTargetId: string; error: string }) {
  const { userId, postTargetId, error } = data;

  const userSnap = await usersRef.doc(userId).get();
  const user = userSnap.data();
  if (!user?.email) return;

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'SocialHub <notifications@socialhub.app>',
      to: user.email,
      subject: 'Post Publishing Failed — SocialHub',
      html: `
        <h2>Post Publishing Failed</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>Unfortunately, one of your scheduled posts failed to publish.</p>
        <p><strong>Error:</strong> ${error}</p>
        <p>You can review and retry from your <a href="${process.env.NEXTAUTH_URL}/dashboard/queue">queue dashboard</a>.</p>
        <p>— The SocialHub Team</p>
      `,
    });

    logger.info({ userId, postTargetId }, 'Failure notification email sent');
  }
}

/** Process a single token-refresh job. */
async function processTokenRefreshJob(data: { socialAccountId: string }) {
  const { socialAccountId } = data;

  const saSnap = await socialAccountsRef.doc(socialAccountId).get();
  const account = saSnap.data();
  if (!account) return;

  const tokens: PlatformTokens = {
    accessToken: decrypt(account.accessToken),
    refreshToken: account.refreshToken ? decrypt(account.refreshToken) : undefined,
  };

  const connector = getConnector(account.platform.toLowerCase());
  const newTokens = await connector.refreshAccessToken(tokens);

  await socialAccountsRef.doc(socialAccountId).update({
    accessToken: encrypt(newTokens.accessToken),
    refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : null,
    tokenExpiresAt: newTokens.expiresAt || null,
  });

  logger.info({ socialAccountId, platform: account.platform }, 'Token refreshed');
}

/** Handle a failed publish job. */
async function handlePublishFailure(data: { postTargetId: string }, error: Error, attempts: number, maxAttempts: number) {
  const { postTargetId } = data;
  logger.error({ postTargetId, error: error.message, attempt: attempts }, 'Post publish failed');

  if (attempts >= maxAttempts) {
    const targetSnap = await postTargetsRef.doc(postTargetId).get();
    const target = targetSnap.data();
    if (target) {
      await postTargetsRef.doc(postTargetId).update({
        status: 'FAILED',
        errorMessage: error.message.substring(0, 500),
        retryCount: attempts,
      });
      await postsRef.doc(target.postId).update({
        status: 'FAILED',
        errorMessage: error.message.substring(0, 500),
      });
      const postSnap = await postsRef.doc(target.postId).get();
      const post = postSnap.data();
      if (post) {
        await emailNotifyQueue.add('failure', {
          userId: post.userId,
          postTargetId,
          error: error.message,
        });
      }
    }
  }
}

/** Process a single job document. */
async function processJob(jobDoc: FirebaseFirestore.DocumentSnapshot) {
  const job = jobDoc.data()!;
  const jobId = jobDoc.id;

  await jobsRef.doc(jobId).update({ status: 'active', attempts: job.attempts + 1 });

  try {
    switch (job.queue) {
      case QUEUE_NAMES.POST_PUBLISH:
        await processPublishJob(job.data);
        break;
      case QUEUE_NAMES.METRICS_FETCH:
        await processMetricsFetchJob(job.data);
        break;
      case QUEUE_NAMES.EMAIL_NOTIFY:
        await processEmailNotifyJob(job.data);
        break;
      case QUEUE_NAMES.TOKEN_REFRESH:
        await processTokenRefreshJob(job.data);
        break;
      default:
        logger.warn({ queue: job.queue }, 'Unknown queue');
    }

    await jobsRef.doc(jobId).update({ status: 'completed', completedAt: new Date() });
    logger.info({ jobId, queue: job.queue }, 'Job completed');
  } catch (err: any) {
    const attempts = job.attempts + 1;

    if (attempts >= job.maxAttempts) {
      await jobsRef.doc(jobId).update({
        status: 'failed',
        error: err.message?.substring(0, 500) || 'Unknown error',
      });
      if (job.queue === QUEUE_NAMES.POST_PUBLISH) {
        await handlePublishFailure(job.data, err, attempts, job.maxAttempts);
      }
    } else {
      const backoff = Math.pow(2, attempts) * 5000;
      await jobsRef.doc(jobId).update({
        status: 'pending',
        processAfter: new Date(Date.now() + backoff),
        error: err.message?.substring(0, 500) || 'Unknown error',
      });
    }

    logger.error({ jobId, err: err.message, attempt: attempts }, 'Job failed');
  }
}

/** Poll for and process pending jobs. */
async function pollJobs() {
  const now = new Date();
  const snap = await jobsRef
    .where('status', '==', 'pending')
    .where('processAfter', '<=', now)
    .orderBy('processAfter')
    .limit(10)
    .get();

  for (const doc of snap.docs) {
    await processJob(doc);
  }

  return snap.docs.length;
}

/** Main worker loop. */
async function main() {
  logger.info('Starting Firestore job worker...');

  const run = async () => {
    try {
      const processed = await pollJobs();
      if (processed > 0) {
        logger.info({ processed }, 'Processed jobs');
      }
    } catch (err) {
      logger.error({ err }, 'Worker poll error');
    }
    setTimeout(run, POLL_INTERVAL);
  };

  run();
}

main();
