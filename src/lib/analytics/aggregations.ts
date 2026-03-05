import { prisma } from '@/lib/db';
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
 * Aggregate analytics data for a user within a date range.
 */
export async function getUserAnalytics(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  // Get all post targets with metrics for this user in the date range
  const targets = await prisma.postTarget.findMany({
    where: {
      post: {
        userId,
        publishedAt: { gte: startDate, lte: endDate },
      },
      status: 'PUBLISHED',
    },
    include: {
      post: true,
      metrics: {
        orderBy: { fetchedAt: 'desc' },
        take: 1, // Latest metrics snapshot
      },
      socialAccount: {
        select: { platform: true, username: true },
      },
    },
  });

  // Aggregate totals
  let totalImpressions = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalClicks = 0;

  for (const t of targets) {
    const m = t.metrics[0];
    if (m) {
      totalImpressions += m.impressions;
      totalLikes += m.likes;
      totalComments += m.comments;
      totalShares += m.shares;
      totalClicks += m.clicks;
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
      platform: t.socialAccount.platform,
      publishedAt: t.post.publishedAt,
      publishedUrl: t.publishedUrl,
      metrics: t.metrics[0] || null,
    })),
  };
}

/**
 * Generate a posting times heatmap (hour × day grid).
 */
export async function getPostingHeatmap(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<TimeHeatmapEntry[]> {
  const targets = await prisma.postTarget.findMany({
    where: {
      post: {
        userId,
        publishedAt: { gte: startDate, lte: endDate },
      },
      status: 'PUBLISHED',
    },
    include: {
      post: { select: { publishedAt: true } },
      metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
  });

  // Group by day of week + hour
  const grid = new Map<string, { totalEngagement: number; count: number }>();

  for (const t of targets) {
    const dt = t.post.publishedAt;
    if (!dt) continue;

    const dayOfWeek = dt.getUTCDay();
    const hour = dt.getUTCHours();
    const key = `${dayOfWeek}-${hour}`;

    const m = t.metrics[0];
    const engagement = m ? m.likes + m.comments + m.shares : 0;

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
  const targets = await prisma.postTarget.findMany({
    where: {
      post: {
        userId,
        publishedAt: { gte: startDate, lte: endDate },
      },
      status: 'PUBLISHED',
    },
    include: {
      post: { select: { mediaUrls: true, link: true, content: true } },
      metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
  });

  const buckets: Record<string, { engagement: number; impressions: number; count: number }> = {
    text: { engagement: 0, impressions: 0, count: 0 },
    image: { engagement: 0, impressions: 0, count: 0 },
    video: { engagement: 0, impressions: 0, count: 0 },
    link: { engagement: 0, impressions: 0, count: 0 },
  };

  for (const t of targets) {
    let type = 'text';
    if (t.post.mediaUrls.some((u) => /\.(mp4|mov|webm)/i.test(u))) type = 'video';
    else if (t.post.mediaUrls.length > 0) type = 'image';
    else if (t.post.link) type = 'link';

    const m = t.metrics[0];
    const engagement = m ? m.likes + m.comments + m.shares : 0;
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
  const targets = await prisma.postTarget.findMany({
    where: {
      post: {
        userId,
        publishedAt: { gte: startDate, lte: endDate },
      },
      status: 'PUBLISHED',
    },
    include: {
      socialAccount: { select: { platform: true } },
      metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
  });

  const byPlatform = new Map<string, { engagement: number; impressions: number; count: number }>();

  for (const t of targets) {
    const platform = t.socialAccount.platform;
    const m = t.metrics[0];
    const engagement = m ? m.likes + m.comments + m.shares : 0;
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
    totalFollowersGrowth: 0, // Would need historical data
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
  const targets = await prisma.postTarget.findMany({
    where: {
      post: {
        userId,
        publishedAt: { gte: startDate, lte: endDate },
      },
      status: 'PUBLISHED',
    },
    include: {
      post: { select: { content: true } },
      metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
    },
  });

  const tagMap = new Map<string, { engagement: number; count: number }>();

  for (const t of targets) {
    const text = t.post.content || '';
    const hashtags = text.match(/#\w+/g) || [];
    const m = t.metrics[0];
    const engagement = m ? m.likes + m.comments + m.shares : 0;

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
