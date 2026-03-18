import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getUserAnalytics,
  getPostingHeatmap,
  getContentTypePerformance,
  getPlatformComparison,
  getTopHashtags,
} from '@/lib/analytics';
import { usersRef } from '@/lib/db';
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
        heatmap: ['twitter', 'reddit', 'linkedin'].flatMap((plat) =>
          Array.from({ length: 7 }, (_, day) =>
            Array.from({ length: 24 }, (_, hour) => ({
              dayOfWeek: day,
              hour,
              avgEngagement: Math.floor(Math.random() * 50),
              platform: plat,
            }))
          ).flat()
        ),
        contentTypes: [
          { type: 'text', count: 20, avgEngagement: 85, platform: 'twitter' },
          { type: 'link', count: 15, avgEngagement: 120, platform: 'twitter' },
          { type: 'image', count: 7, avgEngagement: 210, platform: 'twitter' },
          { type: 'text', count: 10, avgEngagement: 65, platform: 'reddit' },
          { type: 'link', count: 22, avgEngagement: 180, platform: 'reddit' },
          { type: 'image', count: 4, avgEngagement: 95, platform: 'linkedin' },
          { type: 'text', count: 8, avgEngagement: 55, platform: 'linkedin' },
        ],
        platforms: [
          { platform: 'twitter', posts: 18, impressions: 8200, engagement: 1400, avgEngagement: 78, avgImpressions: 456 },
          { platform: 'reddit', posts: 14, impressions: 6800, engagement: 1200, avgEngagement: 86, avgImpressions: 486 },
          { platform: 'linkedin', posts: 10, impressions: 3400, engagement: 610, avgEngagement: 61, avgImpressions: 340 },
        ],
        hashtags: [
          { tag: '#webdev', count: 12, avgEngagement: 92, platform: 'twitter' },
          { tag: '#javascript', count: 9, avgEngagement: 78, platform: 'twitter' },
          { tag: '#ai', count: 7, avgEngagement: 104, platform: 'linkedin' },
          { tag: '#startup', count: 5, avgEngagement: 66, platform: 'linkedin' },
          { tag: '#oss', count: 4, avgEngagement: 53, platform: 'twitter' },
        ],
        flairs: [
          { flair: 'Discussion', count: 8, avgEngagement: 130, platform: 'reddit' },
          { flair: 'Show & Tell', count: 6, avgEngagement: 210, platform: 'reddit' },
          { flair: 'Question', count: 5, avgEngagement: 95, platform: 'reddit' },
          { flair: 'Resource', count: 4, avgEngagement: 78, platform: 'reddit' },
        ],
        maxDaysAllowed: 1825,
      });
    }

    const { searchParams } = new URL(req.url);

    // Check plan for date window limits
    const userSnap = await usersRef.doc(session.user.id).get();
    const user = userSnap.data();

    const maxDays = user?.plan === 'PREMIUM' ? 365 * 5 : FREE_TIER_LIMITS.analyticsWindowDays;
    const requestedDays = Math.min(
      parseInt(searchParams.get('days') || '30'),
      maxDays
    );
    const requestedPlatform = (searchParams.get('platform') || '').trim().toLowerCase() || undefined;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - requestedDays);

    const [overview, heatmap, contentTypes, platforms, hashtags] = await Promise.all([
      getUserAnalytics(session.user.id, startDate, endDate, requestedPlatform),
      getPostingHeatmap(session.user.id, startDate, endDate, requestedPlatform),
      getContentTypePerformance(session.user.id, startDate, endDate, requestedPlatform),
      getPlatformComparison(session.user.id, startDate, endDate, requestedPlatform),
      getTopHashtags(session.user.id, startDate, endDate, 20, requestedPlatform),
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
