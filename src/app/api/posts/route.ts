import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
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
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });

    if (user?.plan === 'FREE') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const postCount = await prisma.post.count({
        where: {
          userId: session.user.id,
          createdAt: { gte: startOfMonth },
          status: { not: 'DRAFT' },
        },
      });

      if (postCount >= FREE_TIER_LIMITS.maxPostsPerMonth) {
        return NextResponse.json(
          { error: `Free tier limited to ${FREE_TIER_LIMITS.maxPostsPerMonth} posts/month. Upgrade to Premium.` },
          { status: 403 }
        );
      }
    }

    const isPremium = user?.plan === 'PREMIUM';

    // Create post + targets in a transaction
    const post = await prisma.$transaction(async (tx) => {
      const newPost = await tx.post.create({
        data: {
          userId: session.user.id,
          title: input.content.title,
          content: input.content.text,
          mediaUrls: input.content.mediaUrls || [],
          link: input.content.link,
          status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        },
      });

      // Create post targets for each platform
      const targets = await Promise.all(
        input.targets.map((t) =>
          tx.postTarget.create({
            data: {
              postId: newPost.id,
              socialAccountId: t.socialAccountId,
              platform: t.platform.toUpperCase() as any,
              subreddit: t.subreddit,
              flair: t.flair,
              status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
            },
          })
        )
      );

      return { ...newPost, targets };
    });

    // Schedule posts if a time was given
    if (input.scheduledAt) {
      const scheduledAt = new Date(input.scheduledAt);
      await Promise.all(
        post.targets.map((t) => schedulePost(t.id, scheduledAt, isPremium))
      );
    }

    logger.info(
      { postId: post.id, targetCount: post.targets.length, scheduled: !!input.scheduledAt },
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
        { id: '1', title: 'Launching our new AI feature', content: 'Excited to announce...', status: 'PUBLISHED', createdAt: new Date().toISOString(), targets: [{ id: 't1', socialAccount: { id: 'sa1', platform: 'TWITTER', username: '@debuguser', avatarUrl: null } }] },
        { id: '2', title: 'Weekly dev update #12', content: 'This week we shipped...', status: 'PUBLISHED', createdAt: new Date(Date.now() - 86400_000).toISOString(), targets: [{ id: 't2', socialAccount: { id: 'sa2', platform: 'REDDIT', username: 'u/debuguser', avatarUrl: null } }] },
        { id: '3', title: 'Best practices for social media', content: 'Here are 5 tips...', status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 86400_000).toISOString(), createdAt: new Date(Date.now() - 3600_000).toISOString(), targets: [{ id: 't3', socialAccount: { id: 'sa3', platform: 'LINKEDIN', username: 'Debug User', avatarUrl: null } }] },
        { id: '4', title: 'Draft post idea', content: 'Need to flesh this out...', status: 'DRAFT', createdAt: new Date(Date.now() - 172800_000).toISOString(), targets: [] },
        { id: '5', title: 'Failed cross-post attempt', content: 'Testing error handling...', status: 'FAILED', createdAt: new Date(Date.now() - 259200_000).toISOString(), targets: [{ id: 't5', socialAccount: { id: 'sa1', platform: 'TWITTER', username: '@debuguser', avatarUrl: null } }] },
      ];
      return NextResponse.json({ posts: mockPosts, total: mockPosts.length, page: 1, limit: 20 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: any = { userId: session.user.id };
    if (status) {
      where.status = status.toUpperCase();
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          targets: {
            include: {
              socialAccount: {
                select: { id: true, platform: true, username: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({ posts, total, page, limit });
  } catch (err) {
    logger.error({ err }, 'List posts failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
