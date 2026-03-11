import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { usersRef, postsRef, postTargetsRef, socialAccountsRef, postMetricsRef } from '@/lib/db';
import { logger } from '@/lib/logger';

/** GET /api/analytics/export — Export analytics data as CSV. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Premium only
    const userSnap = await usersRef.doc(session.user.id).get();
    const user = userSnap.data();

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

    // Get user's published posts in date range
    const postsSnap = await postsRef
      .where('userId', '==', session.user.id)
      .where('publishedAt', '>=', startDate)
      .get();

    const postIds = postsSnap.docs.map((d) => d.id);
    const postsMap = new Map(postsSnap.docs.map((d) => [d.id, d.data()]));

    // Get published targets (batch by 30 for Firestore 'in' limit)
    const targetDocs: Array<{ id: string; [key: string]: any }> = [];
    for (let i = 0; i < postIds.length; i += 30) {
      const batch = postIds.slice(i, i + 30);
      const snap = await postTargetsRef
        .where('postId', 'in', batch)
        .where('status', '==', 'PUBLISHED')
        .get();
      snap.docs.forEach((d) => targetDocs.push({ id: d.id, ...d.data() }));
    }

    // Batch-fetch social accounts
    const saIds = [...new Set(targetDocs.map((t) => t.socialAccountId))];
    const saMap = new Map<string, Record<string, any>>();
    for (let i = 0; i < saIds.length; i += 30) {
      const batch = saIds.slice(i, i + 30);
      const snap = await socialAccountsRef.where('__name__', 'in', batch).get();
      snap.docs.forEach((d) => saMap.set(d.id, d.data()));
    }

    // Fetch latest metric for each target
    const metricsMap = new Map<string, Record<string, any>>();
    for (const t of targetDocs) {
      const mSnap = await postMetricsRef
        .where('postTargetId', '==', t.id)
        .orderBy('fetchedAt', 'desc')
        .limit(1)
        .get();
      if (!mSnap.empty) metricsMap.set(t.id, mSnap.docs[0].data());
    }

    // Build CSV
    const headers = [
      'Platform', 'Username', 'Published At', 'Title', 'URL',
      'Impressions', 'Likes', 'Comments', 'Shares', 'Saves', 'Clicks',
    ];

    const rows = targetDocs.map((t) => {
      const post = postsMap.get(t.postId) || {} as any;
      const sa = saMap.get(t.socialAccountId) || {} as any;
      const m = metricsMap.get(t.id);
      return [
        sa.platform || '',
        sa.username || '',
        post.publishedAt?.toDate?.()?.toISOString?.() || '',
        (post.title || '').replace(/"/g, '""'),
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
