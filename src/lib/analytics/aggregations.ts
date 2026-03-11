import { postsRef, postTargetsRef, postMetricsRef, socialAccountsRef, batchGetByIds } from '@/lib/db';
import { logger } from '@/lib/logger';

interface TimeHeatmapEntry {
  dayOfWeek: number; // 0=Sun, 6=Sat
  hour: number; // 0-23
  avgEngagement: number;
  postCount: number;
}

interface ContentTypePerformance {
  type: 'text' | 'image' | 'video' | 'link';
  avgEngagement: number;
  avgImpressions: number;
  postCount: number;
}

interface PlatformComparison {
  platform: string;
  totalPosts: number;
  avgEngagement: number;
  avgImpressions: number;
  totalFollowersGrowth: number;
}

/**
 * Fetch published post targets with their related data for a user within a date range.
 * This is the shared data-fetching logic used by all aggregation functions.
 */
async function getPublishedTargetsWithData(userId: string, startDate: Date, endDate: Date) {
  // Step 1: Get user's published posts in date range
  const postsSnap = await postsRef
    .where('userId', '==', userId)
    .where('publishedAt', '>=', startDate)
    .where('publishedAt', '<=', endDate)
    .get();

  if (postsSnap.empty) return [];

  const postsMap = new Map<string, Record<string, any>>();
  postsSnap.docs.forEach((d) => postsMap.set(d.id, { id: d.id, ...d.data() }));
  const postIds = [...postsMap.keys()];

  // Step 2: Get post targets for these posts (batch by 30 for Firestore 'in' limit)
  const targetDocs: Array<{ id: string; [key: string]: any }> = [];
  for (let i = 0; i < postIds.length; i += 30) {
    const batch = postIds.slice(i, i + 30);
    const snap = await postTargetsRef
      .where('postId', 'in', batch)
      .where('status', '==', 'PUBLISHED')
      .get();
    snap.docs.forEach((d) => targetDocs.push({ id: d.id, ...d.data() }));
  }

  if (targetDocs.length === 0) return [];

  // Step 3: Batch-fetch social accounts
  const saIds = [...new Set(targetDocs.map((t) => t.socialAccountId))];
  const socialAccounts = await batchGetByIds(socialAccountsRef, saIds);

  // Step 4: Fetch latest metric for each target
  const metricsMap = new Map<string, Record<string, any>>();
  for (const t of targetDocs) {
    const snap = await postMetricsRef
      .where('postTargetId', '==', t.id)
      .orderBy('fetchedAt', 'desc')
      .limit(1)
      .get();
    if (!snap.empty) {
      metricsMap.set(t.id, { id: snap.docs[0].id, ...snap.docs[0].data() });
    }
  }

  // Assemble
  return targetDocs.map((t) => ({
    ...t,
    postId: t.postId as string,
    socialAccountId: t.socialAccountId as string,
    publishedUrl: t.publishedUrl as string | undefined,
    post: postsMap.get(t.postId)!,
    socialAccount: socialAccounts.get(t.socialAccountId) || null,
    metrics: metricsMap.has(t.id) ? [metricsMap.get(t.id)!] : [],
  }));
}

/**
 * Aggregate analytics data for a user within a date range.
 */
export async function getUserAnalytics(userId: string, startDate: Date, endDate: Date) {
  const targets = await getPublishedTargetsWithData(userId, startDate, endDate);

  let totalImpressions = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalClicks = 0;

  for (const t of targets) {
    const m = t.metrics[0];
    if (m) {
      totalImpressions += m.impressions || 0;
      totalLikes += m.likes || 0;
      totalComments += m.comments || 0;
      totalShares += m.shares || 0;
      totalClicks += m.clicks || 0;
    }
  }

  const totalEngagement = totalLikes + totalComments + totalShares;
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return {
    summary: {
      totalPosts: targets.length,
      totalImpressions,
      totalEngagement,
      totalLikes,
      totalComments,
      totalShares,
      totalClicks,
      avgCTR: Math.round(avgCTR * 100) / 100,
    },
    posts: targets.map((t) => ({
      id: t.id,
      postId: t.postId,
      platform: t.socialAccount?.platform,
      publishedAt: t.post.publishedAt,
      publishedUrl: t.publishedUrl,
      metrics: t.metrics[0] || null,
    })),
  };
}

/**
 * Generate a posting times heatmap (hour x day grid).
 */
export async function getPostingHeatmap(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<TimeHeatmapEntry[]> {
  const targets = await getPublishedTargetsWithData(userId, startDate, endDate);

  const grid = new Map<string, { totalEngagement: number; count: number }>();

  for (const t of targets) {
    const dt = t.post.publishedAt?.toDate?.() ?? t.post.publishedAt;
    if (!dt) continue;

    const d = new Date(dt);
    const dayOfWeek = d.getUTCDay();
    const hour = d.getUTCHours();
    const key = `${dayOfWeek}-${hour}`;

    const m = t.metrics[0];
    const engagement = m ? (m.likes || 0) + (m.comments || 0) + (m.shares || 0) : 0;

    const existing = grid.get(key) || { totalEngagement: 0, count: 0 };
    grid.set(key, {
      totalEngagement: existing.totalEngagement + engagement,
      count: existing.count + 1,
    });
  }

  const heatmap: TimeHeatmapEntry[] = [];
  for (const [key, val] of grid) {
    const [day, hour] = key.split('-').map(Number);
    heatmap.push({
      dayOfWeek: day,
      hour,
      avgEngagement: Math.round(val.totalEngagement / val.count),
      postCount: val.count,
    });
  }

  return heatmap;
}

/**
 * Get performance broken down by content type.
 */
export async function getContentTypePerformance(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ContentTypePerformance[]> {
  const targets = await getPublishedTargetsWithData(userId, startDate, endDate);

  const buckets: Record<string, { engagement: number; impressions: number; count: number }> = {
    text: { engagement: 0, impressions: 0, count: 0 },
    image: { engagement: 0, impressions: 0, count: 0 },
    video: { engagement: 0, impressions: 0, count: 0 },
    link: { engagement: 0, impressions: 0, count: 0 },
  };

  for (const t of targets) {
    const mediaUrls = t.post.mediaUrls || [];
    let type = 'text';
    if (mediaUrls.some((u: string) => /\.(mp4|mov|webm)/i.test(u))) type = 'video';
    else if (mediaUrls.length > 0) type = 'image';
    else if (t.post.link) type = 'link';

    const m = t.metrics[0];
    const engagement = m ? (m.likes || 0) + (m.comments || 0) + (m.shares || 0) : 0;
    const impressions = m?.impressions || 0;

    buckets[type].engagement += engagement;
    buckets[type].impressions += impressions;
    buckets[type].count += 1;
  }

  return Object.entries(buckets)
    .filter(([_, v]) => v.count > 0)
    .map(([type, v]) => ({
      type: type as ContentTypePerformance['type'],
      avgEngagement: Math.round(v.engagement / v.count),
      avgImpressions: Math.round(v.impressions / v.count),
      postCount: v.count,
    }));
}

/**
 * Compare performance across connected platforms.
 */
export async function getPlatformComparison(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<PlatformComparison[]> {
  const targets = await getPublishedTargetsWithData(userId, startDate, endDate);

  const byPlatform = new Map<string, { engagement: number; impressions: number; count: number }>();

  for (const t of targets) {
    const platform = t.socialAccount?.platform || 'unknown';
    const m = t.metrics[0];
    const engagement = m ? (m.likes || 0) + (m.comments || 0) + (m.shares || 0) : 0;
    const impressions = m?.impressions || 0;

    const existing = byPlatform.get(platform) || { engagement: 0, impressions: 0, count: 0 };
    byPlatform.set(platform, {
      engagement: existing.engagement + engagement,
      impressions: existing.impressions + impressions,
      count: existing.count + 1,
    });
  }

  return Array.from(byPlatform.entries()).map(([platform, v]) => ({
    platform,
    totalPosts: v.count,
    avgEngagement: Math.round(v.engagement / v.count),
    avgImpressions: Math.round(v.impressions / v.count),
    totalFollowersGrowth: 0,
  }));
}

/**
 * Get top-performing hashtags/keywords.
 */
export async function getTopHashtags(
  userId: string,
  startDate: Date,
  endDate: Date,
  limit = 20
): Promise<Array<{ tag: string; avgEngagement: number; count: number }>> {
  const targets = await getPublishedTargetsWithData(userId, startDate, endDate);

  const tagMap = new Map<string, { engagement: number; count: number }>();

  for (const t of targets) {
    const text = t.post.content || '';
    const hashtags = text.match(/#\w+/g) || [];
    const m = t.metrics[0];
    const engagement = m ? (m.likes || 0) + (m.comments || 0) + (m.shares || 0) : 0;

    for (const tag of hashtags) {
      const lower = tag.toLowerCase();
      const existing = tagMap.get(lower) || { engagement: 0, count: 0 };
      tagMap.set(lower, {
        engagement: existing.engagement + engagement,
        count: existing.count + 1,
      });
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, v]) => ({
      tag,
      avgEngagement: Math.round(v.engagement / v.count),
      count: v.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, limit);
}
