import {
  postTargetsRef,
  postsRef,
  socialAccountsRef,
  postMetricsRef,
  generateId,
} from '@/lib/db';
import { getConnector } from '@/lib/connectors';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import type { PlatformTokens } from '@/types';

/**
 * Scheduled metrics aggregation worker.
 * Runs to fetch latest metrics for all published posts from the last 30 days.
 */
async function runMetricsAggregation() {
  logger.info('Starting metrics aggregation run');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get recent published posts
  const postsSnap = await postsRef
    .where('status', '==', 'PUBLISHED')
    .where('publishedAt', '>=', thirtyDaysAgo)
    .get();

  const postIds = postsSnap.docs.map((d) => d.id);
  if (postIds.length === 0) {
    logger.info('No recent published posts found');
    return;
  }

  // Get published post targets (batch by 30 for Firestore 'in' limit)
  const targets: Array<{ id: string; [key: string]: any }> = [];
  for (let i = 0; i < postIds.length; i += 30) {
    const batch = postIds.slice(i, i + 30);
    const snap = await postTargetsRef
      .where('postId', 'in', batch)
      .where('status', '==', 'PUBLISHED')
      .get();
    snap.docs.forEach((d) => targets.push({ id: d.id, ...d.data() }));
  }

  logger.info({ count: targets.length }, 'Posts to fetch metrics for');

  let successCount = 0;
  let failCount = 0;

  for (const target of targets) {
    try {
      if (!target.platformPostId) continue;

      const saSnap = await socialAccountsRef.doc(target.socialAccountId).get();
      const sa = saSnap.data();
      if (!sa) continue;

      const tokens: PlatformTokens = {
        accessToken: decrypt(sa.accessToken),
        refreshToken: sa.refreshToken ? decrypt(sa.refreshToken) : undefined,
      };

      const connector = getConnector(target.platform.toLowerCase());
      const metrics = await connector.fetchMetrics(tokens, target.platformPostId);

      await postMetricsRef.doc(generateId()).set({
        postTargetId: target.id,
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

runMetricsAggregation()
  .catch((err) => {
    logger.error({ err }, 'Metrics aggregation failed');
    process.exit(1);
  })
  .then(() => process.exit(0));
