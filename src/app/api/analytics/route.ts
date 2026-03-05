import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getUserAnalytics,
  getPostingHeatmap,
  getContentTypePerformance,
  getPlatformComparison,
  getTopHashtags,
} from '@/lib/analytics';
import { prisma } from '@/lib/db';
import { FREE_TIER_LIMITS } from '@/types';
import { logger } from '@/lib/logger';

/** GET /api/analytics — Get comprehensive analytics for the current user. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Debug mode: return mock analytics data
    if (process.env.DEBUG_AUTH === 'true') {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      return NextResponse.json({
        period: { startDate, endDate, days: 30 },
        overview: { totalPosts: 42, totalImpressions: 18_400, totalEngagement: 3_210, avgEngagementRate: 0.174 },
        recentPosts: [],
        heatmap: Array.from({ length: 7 }, (_, day) =>
          Array.from({ length: 24 }, (_, hour) => ({ day, hour, count: Math.floor(Math.random() * 5) }))
        ).flat(),
        contentTypes: [
          { type: 'text', count: 20, avgEngagement: 85 },
          { type: 'link', count: 15, avgEngagement: 120 },
          { type: 'image', count: 7, avgEngagement: 210 },
        ],
        platforms: [
          { platform: 'twitter', posts: 18, impressions: 8200, engagement: 1400 },
          { platform: 'reddit', posts: 14, impressions: 6800, engagement: 1200 },
          { platform: 'linkedin', posts: 10, impressions: 3400, engagement: 610 },
        ],
        hashtags: [
          { tag: '#webdev', count: 12 }, { tag: '#javascript', count: 9 },
          { tag: '#ai', count: 7 }, { tag: '#startup', count: 5 }, { tag: '#oss', count: 4 },
        ],
        maxDaysAllowed: 1825,
      });
    }

    const { searchParams } = new URL(req.url);

    // Check plan for date window limits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });

    const maxDays = user?.plan === 'PREMIUM' ? 365 * 5 : FREE_TIER_LIMITS.analyticsWindowDays;
    const requestedDays = Math.min(
      parseInt(searchParams.get('days') || '30'),
      maxDays
    );

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - requestedDays);

    const [overview, heatmap, contentTypes, platforms, hashtags] = await Promise.all([
      getUserAnalytics(session.user.id, startDate, endDate),
      getPostingHeatmap(session.user.id, startDate, endDate),
      getContentTypePerformance(session.user.id, startDate, endDate),
      getPlatformComparison(session.user.id, startDate, endDate),
      getTopHashtags(session.user.id, startDate, endDate),
    ]);

    return NextResponse.json({
      period: { startDate, endDate, days: requestedDays },
      overview: overview.summary,
      recentPosts: overview.posts.slice(0, 20),
      heatmap,
      contentTypes,
      platforms,
      hashtags,
      maxDaysAllowed: maxDays,
    });
  } catch (err) {
    logger.error({ err }, 'Analytics fetch failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
