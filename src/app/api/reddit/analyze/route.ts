import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { analyzeSubredditCompliance } from '@/lib/ai/reddit-analyzer';
import { redditAnalyzeSchema } from '@/lib/validations';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/** POST /api/reddit/analyze — Analyze subreddit compliance for a proposed post. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Premium-only feature
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });

    if (user?.plan !== 'PREMIUM') {
      return NextResponse.json(
        { error: 'Reddit rule analysis requires a Premium subscription' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const input = redditAnalyzeSchema.parse(body);

    // Find the user's Reddit social account
    const socialAccount = await prisma.socialAccount.findFirst({
      where: { userId: session.user.id, platform: 'REDDIT' },
      select: { id: true },
    });

    if (!socialAccount) {
      return NextResponse.json(
        { error: 'No Reddit account connected. Please connect your Reddit account first.' },
        { status: 400 }
      );
    }

    const analysis = await analyzeSubredditCompliance({
      userId: session.user.id,
      socialAccountId: socialAccount.id,
      subreddit: input.subreddit,
      title: input.title,
      content: input.content,
      postType: input.postType,
    });

    return NextResponse.json(analysis);
  } catch (err: any) {
    logger.error({ err }, 'Reddit analysis failed');
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
