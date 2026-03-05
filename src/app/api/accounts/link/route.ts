import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { connectAccountSchema } from '@/lib/validations';
import { logger } from '@/lib/logger';

/** POST /api/accounts/link — Link a social account after OAuth flow. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { platform } = connectAccountSchema.parse(body);

    // Count existing accounts for free tier limit
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, _count: { select: { socialAccounts: true } } },
    });

    if (user?.plan === 'FREE' && (user._count?.socialAccounts ?? 0) >= 2) {
      return NextResponse.json(
        { error: 'Free tier limited to 2 connected accounts. Upgrade to Premium.' },
        { status: 403 }
      );
    }

    // The actual OAuth tokens come from the NextAuth Account table
    // We copy them into SocialAccount with encryption
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: platform,
      },
      orderBy: { id: 'desc' },
    });

    if (!account?.access_token) {
      return NextResponse.json({ error: 'No OAuth tokens found. Please authenticate first.' }, { status: 400 });
    }

    const socialAccount = await prisma.socialAccount.upsert({
      where: {
        userId_platform_platformUserId: {
          userId: session.user.id,
          platform: platform.toUpperCase() as any,
          platformUserId: account.providerAccountId,
        },
      },
      update: {
        accessToken: encrypt(account.access_token),
        refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
        tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        platform: platform.toUpperCase() as any,
        platformUserId: account.providerAccountId,
        username: session.user.name || 'unknown',
        accessToken: encrypt(account.access_token),
        refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
        tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
      },
    });

    logger.info({ userId: session.user.id, platform }, 'Social account linked');

    return NextResponse.json({ id: socialAccount.id, platform: socialAccount.platform });
  } catch (err: any) {
    logger.error({ err }, 'Failed to link account');
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** GET /api/accounts/link — List connected social accounts. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Debug mode: return mock connected accounts
    if (process.env.DEBUG_AUTH === 'true') {
      return NextResponse.json([
        { id: 'sa1', platform: 'TWITTER', username: '@debuguser', displayName: 'Debug User', profileUrl: 'https://twitter.com/debuguser', avatarUrl: null, connectedAt: new Date().toISOString() },
        { id: 'sa2', platform: 'REDDIT', username: 'u/debuguser', displayName: 'debuguser', profileUrl: 'https://reddit.com/u/debuguser', avatarUrl: null, connectedAt: new Date().toISOString() },
        { id: 'sa3', platform: 'LINKEDIN', username: 'Debug User', displayName: 'Debug User', profileUrl: 'https://linkedin.com/in/debuguser', avatarUrl: null, connectedAt: new Date().toISOString() },
      ]);
    }

    const accounts = await prisma.socialAccount.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        profileUrl: true,
        avatarUrl: true,
        connectedAt: true,
      },
      orderBy: { connectedAt: 'desc' },
    });

    return NextResponse.json(accounts);
  } catch (err) {
    logger.error({ err }, 'Failed to list accounts');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
