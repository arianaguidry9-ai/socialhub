import { prisma } from '@/lib/db';
import { getConnector } from '@/lib/connectors';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import type { PlatformTokens } from '@/types';

/**
 * Scheduled metrics aggregation worker.
 * Runs every 6 hours to fetch latest metrics for all published posts.
 * Intended to be triggered by a cron job or Bull repeatable.
 */
async function runMetricsAggregation() {
  logger.info('Starting metrics aggregation run');

  // Find all published post targets from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const targets = await prisma.postTarget.findMany({
    where: {
      status: 'PUBLISHED',
      platformPostId: { not: null },
      post: {
        publishedAt: { gte: thirtyDaysAgo },
      },
    },
    include: {
      socialAccount: true,
    },
  });

  logger.info({ count: targets.length }, 'Posts to fetch metrics for');

  let successCount = 0;
  let failCount = 0;

  for (const target of targets) {
    try {
      if (!target.platformPostId) continue;

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
          postTargetId: target.id,
          impressions: metrics.impressions,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          saves: metrics.saves,
          clicks: metrics.clicks,
        },
      });

      successCount++;
    } catch (err) {
      failCount++;
      logger.error(
        { postTargetId: target.id, platform: target.platform, err },
        'Failed to fetch metrics for post'
      );
    }

    // Rate limit: small delay between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  logger.info({ successCount, failCount }, 'Metrics aggregation complete');
}

// Run immediately when script is executed directly
runMetricsAggregation()
  .catch((err) => {
    logger.error({ err }, 'Metrics aggregation failed');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
