import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { socialAccountsRef, accountsRef } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

const TWITTER_API = 'https://api.twitter.com/2';

/**
 * GET /api/analytics/platform?platform=twitter
 *
 * Fetches LIVE account stats directly from the social platform's API
 * using the tokens stored for the current user.
 *
 * Returns profile stats (followers, tweet count, etc.) and recent post metrics.
 * This works even when the user hasn't published anything through SocialHub.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = (searchParams.get('platform') ?? 'twitter').toLowerCase();

    // Find the social account record for this platform
    const saSnap = await socialAccountsRef
      .where('userId', '==', session.user.id)
      .where('platform', '==', platform.toUpperCase())
      .limit(1)
      .get();

    // Fall back to the raw adapter accounts collection if socialAccounts is empty
    let rawAccessToken: string | null = null;
    let platformUserId: string | null = null;

    if (!saSnap.empty) {
      const sa = saSnap.docs[0].data();
      platformUserId = sa.platformUserId ?? null;
      if (sa.accessToken) {
        try {
          rawAccessToken = decrypt(sa.accessToken as string);
        } catch {
          // Token may not be encrypted if it came from the back-fill path
          rawAccessToken = sa.accessToken as string;
        }
      }
    }

    // If socialAccounts has no token try the adapter accounts collection
    if (!rawAccessToken) {
      const adSnap = await accountsRef
        .where('userId', '==', session.user.id)
        .where('provider', '==', platform)
        .limit(1)
        .get();
      if (!adSnap.empty) {
        const ad = adSnap.docs[0].data();
        platformUserId = ad.providerAccountId ?? null;
        if (ad.access_token) {
          try {
            rawAccessToken = decrypt(ad.access_token as string);
          } catch {
            rawAccessToken = ad.access_token as string;
          }
        }
      }
    }

    if (!rawAccessToken) {
      return NextResponse.json(
        { error: 'No access token found. Please reconnect your account.' },
        { status: 404 }
      );
    }

    if (platform === 'twitter') {
      return NextResponse.json(await fetchTwitterLiveData(rawAccessToken, platformUserId));
    }

    return NextResponse.json({ error: `Live data not yet supported for ${platform}` }, { status: 400 });
  } catch (err) {
    logger.error({ err }, 'platform analytics fetch failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function twitterGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${TWITTER_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Twitter API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function fetchTwitterLiveData(token: string, knownUserId: string | null) {
  // Step 1: Get current user profile + public metrics
  const meRes = await twitterGet<any>(
    '/users/me?user.fields=public_metrics,profile_image_url,username,description,created_at',
    token
  );

  const profile = meRes.data;
  const metrics = profile?.public_metrics ?? {};
  const userId = profile?.id ?? knownUserId;

  // Step 2: Fetch the last 20 tweets with public metrics
  let recentTweets: any[] = [];
  let tweetsFetched = false;
  if (userId) {
    try {
      const tweetsRes = await twitterGet<any>(
        `/users/${userId}/tweets?tweet.fields=public_metrics,created_at,text&max_results=20&exclude=retweets`,
        token
      );
      recentTweets = (tweetsRes.data ?? []).map((t: any) => ({
        id: t.id,
        text: t.text,
        createdAt: t.created_at,
        likes:     t.public_metrics?.like_count      ?? 0,
        retweets:  t.public_metrics?.retweet_count   ?? 0,
        replies:   t.public_metrics?.reply_count     ?? 0,
        quotes:    t.public_metrics?.quote_count     ?? 0,
        bookmarks: t.public_metrics?.bookmark_count  ?? 0,
        // impression_count requires elevated access - omit gracefully
        impressions: t.public_metrics?.impression_count ?? null,
        url: `https://x.com/${profile?.username}/status/${t.id}`,
      }));
      tweetsFetched = true;
    } catch (err) {
      logger.warn({ err }, 'fetchTwitterLiveData: tweets fetch failed; returning profile only');
    }
  }

  // Aggregate simple totals from recent tweets
  const totals = recentTweets.reduce(
    (acc, t) => ({
      likes:     acc.likes     + t.likes,
      retweets:  acc.retweets  + t.retweets,
      replies:   acc.replies   + t.replies,
      quotes:    acc.quotes    + t.quotes,
      bookmarks: acc.bookmarks + t.bookmarks,
    }),
    { likes: 0, retweets: 0, replies: 0, quotes: 0, bookmarks: 0 }
  );

  return {
    platform: 'twitter',
    profile: {
      id:            profile?.id,
      username:      profile?.username,
      displayName:   profile?.name,
      description:   profile?.description,
      avatarUrl:     profile?.profile_image_url?.replace('_normal', '_400x400'),
      profileUrl:    `https://x.com/${profile?.username}`,
      joinedAt:      profile?.created_at,
      followers:     metrics.followers_count  ?? 0,
      following:     metrics.following_count  ?? 0,
      tweetCount:    metrics.tweet_count      ?? 0,
      listedCount:   metrics.listed_count     ?? 0,
    },
    recentTweets,
    tweetsFetched,
    totals,
  };
}
