import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { suggestHashtags } from '@/lib/ai';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({
  content: z.string().min(1).max(5000),
  platform: z.enum(['reddit', 'twitter', 'instagram', 'linkedin']),
});

/** POST /api/ai/hashtags — Suggest hashtags for content. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { content, platform } = schema.parse(body);

    const hashtags = await suggestHashtags(session.user.id, content, platform);

    return NextResponse.json({ hashtags });
  } catch (err: any) {
    logger.error({ err }, 'Hashtag suggestion failed');
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to suggest hashtags' }, { status: 500 });
  }
}
