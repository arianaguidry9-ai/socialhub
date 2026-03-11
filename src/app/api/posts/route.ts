import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { usersRef, postsRef, postTargetsRef, socialAccountsRef, postMetricsRef, generateId, firestore } from '@/lib/db';
import { createPostSchema } from '@/lib/validations';
import { schedulePost } from '@/lib/queue/queues';
import { FREE_TIER_LIMITS } from '@/types';
import { logger } from '@/lib/logger';

/** POST /api/posts — Create a new post (draft or scheduled). */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const input = createPostSchema.parse(body);

    // Check free tier post limit
    const userSnap = await usersRef.doc(session.user.id).get();
    const user = userSnap.data();

    if (user?.plan === 'FREE') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const postCountSnap = await postsRef
        .where('userId', '==', session.user.id)
        .where('createdAt', '>=', startOfMonth)
        .where('status', '!=', 'DRAFT')
        .get();

      if (postCountSnap.size >= FREE_TIER_LIMITS.maxPostsPerMonth) {
        return NextResponse.json(
          { error: `Free tier limited to ${FREE_TIER_LIMITS.maxPostsPerMonth} posts/month. Upgrade to Premium.` },
          { status: 403 }
        );
      }
    }

    const isPremium = user?.plan === 'PREMIUM';

    // Create post + targets in a Firestore batch
    const postId = generateId();
    const now = new Date();
    const status = input.scheduledAt ? 'SCHEDULED' : 'DRAFT';

    const batch = firestore.batch();

    const postData = {
      userId: session.user.id,
      title: input.content.title || null,
      content: input.content.text || null,
      mediaUrls: input.content.mediaUrls || [],
      link: input.content.link || null,
      status,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      publishedAt: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    batch.set(postsRef.doc(postId), postData);

    const targets: Array<{ id: string; [key: string]: any }> = [];
    for (const t of input.targets) {
      const targetId = generateId();
      const targetData = {
        postId,
        socialAccountId: t.socialAccountId,
        platform: t.platform.toUpperCase(),
        subreddit: t.subreddit || null,
        flair: t.flair || null,
        platformPostId: null,
        publishedUrl: null,
        status,
        errorMessage: null,
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(postTargetsRef.doc(targetId), targetData);
      targets.push({ id: targetId, ...targetData });
    }

    await batch.commit();

    const post = { id: postId, ...postData, targets };

    // Schedule posts if a time was given
    if (input.scheduledAt) {
      const scheduledAt = new Date(input.scheduledAt);
      await Promise.all(
        targets.map((t) => schedulePost(t.id, scheduledAt, isPremium))
      );
    }

    logger.info(
      { postId: post.id, targetCount: targets.length, scheduled: !!input.scheduledAt },
      'Post created'
    );

    return NextResponse.json(post, { status: 201 });
  } catch (err: any) {
    logger.error({ err }, 'Create post failed');
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** GET /api/posts — List user's posts. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Debug mode: return mock posts
    if (process.env.DEBUG_AUTH === 'true') {
      const mockPosts = [
        { id: '1', title: 'Launching our new AI feature', content: 'Excited to announce...', status: 'PUBLISHED', createdAt: new Date().toISOString(), targets: [{ id: 't1', socialAccount: { id: 'sa1', platform: 'TWITTER', username: '@debuguser', avatarUrl: null }, metrics: [{ impressions: 12400, likes: 89, comments: 23, shares: 45, saves: 12, clicks: 340 }] }] },
        { id: '2', title: 'Weekly dev update #12', content: 'This week we shipped...', status: 'PUBLISHED', createdAt: new Date(Date.now() - 86400_000).toISOString(), targets: [{ id: 't2', socialAccount: { id: 'sa2', platform: 'REDDIT', username: 'u/debuguser', avatarUrl: null }, metrics: [{ impressions: 8700, likes: 247, comments: 12, shares: 34, saves: 5, clicks: 156 }] }] },
        { id: '3', title: 'Best practices for social media', content: 'Here are 5 tips...', status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 86400_000).toISOString(), createdAt: new Date(Date.now() - 3600_000).toISOString(), targets: [{ id: 't3', socialAccount: { id: 'sa3', platform: 'LINKEDIN', username: 'Debug User', avatarUrl: null }, metrics: [] }] },
        { id: '4', title: 'Draft post idea', content: 'Need to flesh this out...', status: 'DRAFT', createdAt: new Date(Date.now() - 172800_000).toISOString(), targets: [] },
        { id: '5', title: 'Failed cross-post attempt', content: 'Testing error handling...', status: 'FAILED', createdAt: new Date(Date.now() - 259200_000).toISOString(), targets: [{ id: 't5', socialAccount: { id: 'sa1', platform: 'TWITTER', username: '@debuguser', avatarUrl: null }, metrics: [{ impressions: 320, likes: 4, comments: 1, shares: 0, saves: 0, clicks: 8 }] }] },
      ];
      return NextResponse.json({ posts: mockPosts, total: mockPosts.length, page: 1, limit: 20 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // Build query
    let query: FirebaseFirestore.Query = postsRef.where('userId', '==', session.user.id);
    if (status) {
      query = query.where('status', '==', status.toUpperCase());
    }
    query = query.orderBy('createdAt', 'desc');

    // Get total count
    const totalSnap = await query.get();
    const total = totalSnap.size;

    // Paginate
    const allDocs = totalSnap.docs.slice((page - 1) * limit, page * limit);

    // Fetch targets, social accounts, and metrics for each post
    const posts = await Promise.all(
      allDocs.map(async (postDoc) => {
        const postData = { id: postDoc.id, ...postDoc.data() };

        const targetsSnap = await postTargetsRef
          .where('postId', '==', postDoc.id)
          .get();

        const targets = await Promise.all(
          targetsSnap.docs.map(async (tDoc) => {
            const tData = tDoc.data();

            // Fetch social account
            const saSnap = await socialAccountsRef.doc(tData.socialAccountId).get();
            const sa = saSnap.data();

            // Fetch latest metric
            const metricsSnap = await postMetricsRef
              .where('postTargetId', '==', tDoc.id)
              .orderBy('fetchedAt', 'desc')
              .limit(1)
              .get();

            const metrics = metricsSnap.docs.map((m) => m.data());

            return {
              id: tDoc.id,
              ...tData,
              socialAccount: sa ? {
                id: saSnap.id,
                platform: sa.platform,
                username: sa.username,
                avatarUrl: sa.avatarUrl,
              } : null,
              metrics,
            };
          })
        );

        return { ...postData, targets };
      })
    );

    return NextResponse.json({ posts, total, page, limit });
  } catch (err) {
    logger.error({ err }, 'List posts failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
