import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { usersRef, accountsRef, socialAccountsRef, generateId, docData } from '@/lib/db';
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
    const userSnap = await usersRef.doc(session.user.id).get();
    const user = userSnap.data();
    const accountsSnap = await socialAccountsRef
      .where('userId', '==', session.user.id)
      .get();

    if (user?.plan === 'FREE' && accountsSnap.size >= 2) {
      return NextResponse.json(
        { error: 'Free tier limited to 2 connected accounts. Upgrade to Premium.' },
        { status: 403 }
      );
    }

    // The actual OAuth tokens come from the NextAuth Account table
    const accountQuery = await accountsRef
      .where('userId', '==', session.user.id)
      .where('provider', '==', platform)
      .limit(1)
      .get();

    const account = accountQuery.empty ? null : accountQuery.docs[0].data();

    if (!account?.access_token) {
      return NextResponse.json({ error: 'No OAuth tokens found. Please authenticate first.' }, { status: 400 });
    }

    // Check for existing social account
    const existingSnap = await socialAccountsRef
      .where('userId', '==', session.user.id)
      .where('platform', '==', platform.toUpperCase())
      .where('platformUserId', '==', account.providerAccountId)
      .limit(1)
      .get();

    let socialAccountId: string;
    let socialAccountPlatform: string;

    if (!existingSnap.empty) {
      // Update existing
      socialAccountId = existingSnap.docs[0].id;
      await socialAccountsRef.doc(socialAccountId).update({
        accessToken: encrypt(account.access_token),
        refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
        tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
        updatedAt: new Date(),
      });
      socialAccountPlatform = existingSnap.docs[0].data().platform;
    } else {
      // Create new
      socialAccountId = generateId();
      socialAccountPlatform = platform.toUpperCase();
      await socialAccountsRef.doc(socialAccountId).set({
        userId: session.user.id,
        platform: socialAccountPlatform,
        platformUserId: account.providerAccountId,
        username: session.user.name || 'unknown',
        displayName: null,
        profileUrl: null,
        avatarUrl: null,
        accessToken: encrypt(account.access_token),
        refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
        tokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
        scopes: null,
        metadata: null,
        connectedAt: new Date(),
        updatedAt: new Date(),
      });
    }

    logger.info({ userId: session.user.id, platform }, 'Social account linked');

    return NextResponse.json({ id: socialAccountId, platform: socialAccountPlatform });
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

    const snap = await socialAccountsRef
      .where('userId', '==', session.user.id)
      .orderBy('connectedAt', 'desc')
      .get();

    const accounts = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        platform: data.platform,
        username: data.username,
        displayName: data.displayName,
        profileUrl: data.profileUrl,
        avatarUrl: data.avatarUrl,
        connectedAt: data.connectedAt?.toDate?.()?.toISOString() ?? data.connectedAt,
      };
    });

    return NextResponse.json(accounts);
  } catch (err) {
    logger.error({ err }, 'Failed to list accounts');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
