import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { usersRef, accountsRef, socialAccountsRef, generateId } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getConnector } from '@/lib/connectors';
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

    // Free-tier limit check
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

    // Read OAuth record written by the NextAuth Firestore adapter.
    // IMPORTANT: our custom adapter pre-encrypts tokens before storage,
    // so account.access_token / account.refresh_token are already encrypted.
    const accountQuery = await accountsRef
      .where('userId', '==', session.user.id)
      .where('provider', '==', platform)
      .limit(1)
      .get();

    const account = accountQuery.empty ? null : accountQuery.docs[0].data();

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'No OAuth tokens found. Please disconnect and reconnect this account.' },
        { status: 400 }
      );
    }

    // Decrypt temporarily — only to call getProfile() for display metadata.
    // The encrypted value is stored as-is (no re-encryption).
    let rawAccessToken: string;
    try {
      rawAccessToken = decrypt(account.access_token as string);
    } catch {
      return NextResponse.json(
        { error: 'Could not read OAuth credentials. Please reconnect.' },
        { status: 400 }
      );
    }

    // Fetch real profile (handle, avatar, profile URL) from the platform
    let username: string = session.user.name || 'unknown';
    let displayName: string | null = null;
    let profileUrl: string | null = null;
    let avatarUrl: string | null = null;

    try {
      const connector = getConnector(platform);
      const profile = await connector.getProfile({ accessToken: rawAccessToken });
      username    = profile.username;
      displayName = profile.displayName ?? null;
      profileUrl  = profile.profileUrl  ?? null;
      avatarUrl   = profile.avatarUrl   ?? null;
    } catch (err) {
      logger.warn({ err, platform }, 'accounts/link: getProfile failed; using session display name');
    }

    // Check whether this exact platform account is already linked
    // Use a 2-field query to avoid requiring a Firestore composite index;
    // filter by platformUserId in code.
    const existingSnap = await socialAccountsRef
      .where('userId', '==', session.user.id)
      .where('platform', '==', platform.toUpperCase())
      .limit(5)
      .get();
    const existingDoc = existingSnap.docs.find(
      (d) => d.data().platformUserId === account.providerAccountId
    ) ?? (existingSnap.empty ? null : existingSnap.docs[0]);

    let socialAccountId: string;
    const socialAccountPlatform = platform.toUpperCase();

    // Tokens are already encrypted by the adapter — copy them as-is.
    const storedAccessToken  = account.access_token  as string;
    const storedRefreshToken = (account.refresh_token  as string | undefined) ?? null;
    const tokenExpiresAt = account.expires_at
      ? new Date((account.expires_at as number) * 1000)
      : null;

    if (!existingDoc) {
      socialAccountId = generateId();
      await socialAccountsRef.doc(socialAccountId).set({
        userId:          session.user.id,
        platform:        socialAccountPlatform,
        platformUserId:  account.providerAccountId as string,
        username,
        displayName,
        profileUrl,
        avatarUrl,
        accessToken:    storedAccessToken,
        refreshToken:   storedRefreshToken,
        tokenExpiresAt,
        scopes:         account.scope  ?? null,
        metadata:       null,
        connectedAt:    new Date(),
        updatedAt:      new Date(),
      });
    } else {
      socialAccountId = existingDoc.id;
      await socialAccountsRef.doc(socialAccountId).update({
        accessToken:    storedAccessToken,
        refreshToken:   storedRefreshToken,
        tokenExpiresAt,
        username,
        displayName,
        profileUrl,
        avatarUrl,
        updatedAt: new Date(),
      });
    }

    logger.info({ userId: session.user.id, platform, username }, 'Social account linked');
    return NextResponse.json({ id: socialAccountId, platform: socialAccountPlatform, username });
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
      .get();

    // ── Lazy back-fill ────────────────────────────────────────────────────────
    // If `socialAccounts` is empty but the user HAS OAuth records in the
    // NextAuth `accounts` adapter collection (e.g. they signed in before the
    // autoSync event was added), write minimal display entries immediately.
    if (snap.empty) {
      const adapterSnap = await accountsRef
        .where('userId', '==', session.user.id)
        .get();

      const writes: Promise<unknown>[] = [];
      for (const adDoc of adapterSnap.docs) {
        const ad = adDoc.data();
        if (!ad.provider || ad.provider === 'credentials') continue;

        const platform = (ad.provider as string).toUpperCase();
        const platformUserId = (ad.providerAccountId as string) ?? '';
        const now = new Date();

        // Single-condition check to avoid needing composite indexes
        const already = await socialAccountsRef
          .where('userId', '==', session.user.id)
          .where('platform', '==', platform)
          .limit(1)
          .get();
        // If an entry already exists for this platform (even different account), skip
        if (!already.empty) continue;

        writes.push(
          socialAccountsRef.doc(generateId()).set({
            userId:       session.user.id,
            platform,
            platformUserId,
            username:     (session.user as any).name ?? (session.user as any).email ?? 'unknown',
            displayName:  (session.user as any).name ?? null,
            profileUrl:   null,
            avatarUrl:    (session.user as any).image ?? null,
            accessToken:  ad.access_token ?? null,
            refreshToken: ad.refresh_token ?? null,
            tokenExpiresAt: ad.expires_at ? new Date((ad.expires_at as number) * 1000) : null,
            scopes:       ad.scope ?? null,
            metadata:     null,
            connectedAt:  now,
            updatedAt:    now,
          })
        );
        logger.info({ userId: session.user.id, platform }, 'accounts/link GET: back-filled socialAccount');
      }
      await Promise.all(writes);

      // Re-query after back-fill (no orderBy to avoid composite index requirement)
      const refilled = await socialAccountsRef
        .where('userId', '==', session.user.id)
        .get();

      const backFilledAccounts = refilled.docs
        .map((d) => {
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
        })
        .sort((a, b) => (b.connectedAt ?? '').localeCompare(a.connectedAt ?? ''));
      return NextResponse.json(backFilledAccounts);
    }

    const accounts = snap.docs
      .map((d) => {
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
      })
      .sort((a, b) => (b.connectedAt ?? '').localeCompare(a.connectedAt ?? ''));

    return NextResponse.json(accounts);
  } catch (err) {
    logger.error({ err }, 'Failed to list accounts');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
