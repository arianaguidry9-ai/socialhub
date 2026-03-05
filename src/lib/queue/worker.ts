import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/db';
import { getConnector } from '@/lib/connectors';
import { decrypt, encrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES, scheduleMetricsFetch, emailNotifyQueue } from './queues';
import type { PlatformTokens, PostContent } from '@/types';

/**
 * Post publishing worker.
 * Processes scheduled posts by sending them to the appropriate platform.
 */
const publishWorker = new Worker(
  QUEUE_NAMES.POST_PUBLISH,
  async (job: Job<{ postTargetId: string }>) => {
    const { postTargetId } = job.data;
    logger.info({ postTargetId, attempt: job.attemptsMade + 1 }, 'Processing post publish job');

    // Load post target with related data
    const target = await prisma.postTarget.findUnique({
      where: { id: postTargetId },
      include: {
        post: true,
        socialAccount: true,
      },
    });

    if (!target) {
      throw new Error(`PostTarget ${postTargetId} not found`);
    }

    // Update status to POSTING
    await prisma.postTarget.update({
      where: { id: postTargetId },
      data: { status: 'POSTING' },
    });

    // Decrypt tokens
    const tokens: PlatformTokens = {
      accessToken: decrypt(target.socialAccount.accessToken),
      refreshToken: target.socialAccount.refreshToken
        ? decrypt(target.socialAccount.refreshToken)
        : undefined,
      expiresAt: target.socialAccount.tokenExpiresAt ?? undefined,
    };

    // Check if token needs refresh
    if (tokens.expiresAt && tokens.expiresAt < new Date()) {
      logger.info({ postTargetId }, 'Refreshing expired token before publish');
      const connector = getConnector(target.platform.toLowerCase());
      const newTokens = await connector.refreshAccessToken(tokens);

      // Update stored tokens
      await prisma.socialAccount.update({
        where: { id: target.socialAccountId },
        data: {
          accessToken: encrypt(newTokens.accessToken),
          refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : undefined,
          tokenExpiresAt: newTokens.expiresAt,
        },
      });

      tokens.accessToken = newTokens.accessToken;
    }

    // Build content
    const content: PostContent = {
      text: target.post.content || undefined,
      title: target.post.title || undefined,
      mediaUrls: target.post.mediaUrls,
      link: target.post.link || undefined,
      subreddit: target.subreddit || undefined,
      flair: target.flair || undefined,
    };

    // Publish
    const connector = getConnector(target.platform.toLowerCase());
    const result = await connector.publish(tokens, content);

    if (result.success) {
      await prisma.postTarget.update({
        where: { id: postTargetId },
        data: {
          status: 'PUBLISHED',
          platformPostId: result.platformPostId,
          publishedUrl: result.publishedUrl,
        },
      });

      // Also update parent post if all targets are published
      const allTargets = await prisma.postTarget.findMany({
        where: { postId: target.postId },
        select: { status: true },
      });
      const allPublished = allTargets.every((t) => t.status === 'PUBLISHED');
      if (allPublished) {
        await prisma.post.update({
          where: { id: target.postId },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        });
      }

      // Schedule metrics fetching
      if (result.platformPostId) {
        await scheduleMetricsFetch(postTargetId);
      }

      logger.info({ postTargetId, platformPostId: result.platformPostId }, 'Post published successfully');
    } else {
      throw new Error(result.error || 'Unknown publish error');
    }
  },
  {
    connection: redis as unknown as ConnectionOptions,
    concurrency: 5,
    limiter: { max: 10, duration: 60000 }, // 10 posts per minute globally
  }
);

publishWorker.on('failed', async (job, error) => {
  const postTargetId = job?.data?.postTargetId;
  logger.error({ postTargetId, error: error.message, attempt: job?.attemptsMade }, 'Post publish failed');

  if (postTargetId && job && job.attemptsMade >= (job.opts.attempts || 3)) {
    // Final failure — mark as failed and notify user
    const target = await prisma.postTarget.update({
      where: { id: postTargetId },
      data: {
        status: 'FAILED',
        errorMessage: error.message.substring(0, 500),
        retryCount: job.attemptsMade,
      },
      include: { post: { select: { userId: true } } },
    });

    // Also fail parent post
    await prisma.post.update({
      where: { id: target.postId },
      data: { status: 'FAILED', errorMessage: error.message.substring(0, 500) },
    });

    // Queue email notification
    await emailNotifyQueue.add('failure', {
      userId: target.post.userId,
      postTargetId,
      error: error.message,
    });
  }
});

publishWorker.on('completed', (job) => {
  logger.info({ postTargetId: job.data.postTargetId }, 'Post publish job completed');
});

/**
 * Metrics fetching worker.
 */
const metricsFetchWorker = new Worker(
  QUEUE_NAMES.METRICS_FETCH,
  async (job: Job<{ postTargetId: string }>) => {
    const { postTargetId } = job.data;
    logger.info({ postTargetId }, 'Fetching metrics');

    const target = await prisma.postTarget.findUnique({
      where: { id: postTargetId },
      include: { socialAccount: true },
    });

    if (!target?.platformPostId) {
      logger.warn({ postTargetId }, 'No platform post ID, skipping metrics');
      return;
    }

    const tokens: PlatformTokens = {
      accessToken: decrypt(target.socialAccount.accessToken),
      refreshToken: target.socialAccount.refreshToken
        ? decrypt(target.socialAccount.refreshToken)
        : undefined,
    };

    const connector = getConnector(target.platform.toLowerCase());
    const metrics = await connector.fetchMetrics(tokens, target.platformPostId);

    await prisma.postMetric.create({
      data: {
        postTargetId,
        impressions: metrics.impressions,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        clicks: metrics.clicks,
      },
    });

    logger.info({ postTargetId, metrics }, 'Metrics fetched and stored');
  },
  {
    connection: redis as unknown as ConnectionOptions,
    concurrency: 10,
  }
);

/**
 * Email notification worker.
 */
const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL_NOTIFY,
  async (job: Job<{ userId: string; postTargetId: string; error: string }>) => {
    const { userId, postTargetId, error } = job.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) return;

    // Use Resend to send failure notification
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
  },
  {
    connection: redis as unknown as ConnectionOptions,
    concurrency: 3,
  }
);

/**
 * Token refresh worker.
 */
const tokenRefreshWorker = new Worker(
  QUEUE_NAMES.TOKEN_REFRESH,
  async (job: Job<{ socialAccountId: string }>) => {
    const { socialAccountId } = job.data;

    const account = await prisma.socialAccount.findUnique({
      where: { id: socialAccountId },
    });

    if (!account) return;

    const tokens: PlatformTokens = {
      accessToken: decrypt(account.accessToken),
      refreshToken: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    };

    const connector = getConnector(account.platform.toLowerCase());
    const newTokens = await connector.refreshAccessToken(tokens);

    await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: {
        accessToken: encrypt(newTokens.accessToken),
        refreshToken: newTokens.refreshToken ? encrypt(newTokens.refreshToken) : undefined,
        tokenExpiresAt: newTokens.expiresAt,
      },
    });

    logger.info({ socialAccountId, platform: account.platform }, 'Token refreshed');
  },
  {
    connection: redis as unknown as ConnectionOptions,
    concurrency: 5,
  }
);

export { publishWorker, metricsFetchWorker, emailWorker, tokenRefreshWorker };

// Start all workers
logger.info('Queue workers started');
