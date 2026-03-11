import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { generateCaption, suggestHashtags, repurposeContent } from '@/lib/ai';
import { checkAiRateLimit } from '@/lib/ai/client';
import { aiCaptionSchema } from '@/lib/validations';
import { usersRef } from '@/lib/db';
import { FREE_TIER_LIMITS } from '@/types';
import { logger } from '@/lib/logger';

/** POST /api/ai/caption — Generate a platform-appropriate caption. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const input = aiCaptionSchema.parse(body);

    // Check rate limit for free users
    const userSnap = await usersRef.doc(session.user.id).get();
    const user = userSnap.data();

    if (user?.plan === 'FREE') {
      const allowed = await checkAiRateLimit(
        session.user.id,
        'CAPTION',
        FREE_TIER_LIMITS.maxAiCaptionsPerMonth
      );
      if (!allowed) {
        return NextResponse.json(
          { error: 'Free tier AI caption limit reached (5/month). Upgrade to Premium for unlimited.' },
          { status: 429 }
        );
      }
    }

    const result = await generateCaption(session.user.id, input.topic, input.platform, input.tone);

    return NextResponse.json(result);
  } catch (err: any) {
    logger.error({ err }, 'Caption generation failed');
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Caption generation failed' }, { status: 500 });
  }
}
