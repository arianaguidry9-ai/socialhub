import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/** GET /api/analytics/export — Export analytics data as CSV. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Premium only
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });

    if (user?.plan !== 'PREMIUM') {
      return NextResponse.json(
        { error: 'CSV export requires Premium subscription' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '90');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const targets = await prisma.postTarget.findMany({
      where: {
        post: {
          userId: session.user.id,
          publishedAt: { gte: startDate },
        },
        status: 'PUBLISHED',
      },
      include: {
        post: { select: { title: true, content: true, publishedAt: true } },
        socialAccount: { select: { platform: true, username: true } },
        metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });

    // Build CSV
    const headers = [
      'Platform', 'Username', 'Published At', 'Title', 'URL',
      'Impressions', 'Likes', 'Comments', 'Shares', 'Saves', 'Clicks',
    ];

    const rows = targets.map((t) => {
      const m = t.metrics[0];
      return [
        t.socialAccount.platform,
        t.socialAccount.username,
        t.post.publishedAt?.toISOString() || '',
        (t.post.title || '').replace(/"/g, '""'),
        t.publishedUrl || '',
        m?.impressions || 0,
        m?.likes || 0,
        m?.comments || 0,
        m?.shares || 0,
        m?.saves || 0,
        m?.clicks || 0,
      ].map((v) => `"${v}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="socialhub-analytics-${days}d.csv"`,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Analytics export failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
