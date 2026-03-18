import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import TwitterProvider from 'next-auth/providers/twitter';
import { usersRef, socialAccountsRef, accountsRef, generateId } from '@/lib/db';
import { logger } from '@/lib/logger';
import { verifyPassword } from '@/lib/auth/passwords';
import { createFirestoreAdapter } from '@/lib/auth/firestore-adapter';
import { encrypt } from '@/lib/encryption';
import { getConnector } from '@/lib/connectors';

/**
 * Auto-populate the `socialAccounts` display collection whenever a user
 * signs in via OAuth.  Called from the `events.signIn` hook so it never
 * blocks the sign-in flow (failures are logged, not surfaced to the user).
 */
async function autoSyncSocialAccount(
  userId: string,
  account: {
    provider: string;
    providerAccountId: string;
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
    scope?: string | null;
  },
  user: { name?: string | null; email?: string | null; image?: string | null }
) {
  if (!account.access_token) return;

  const platform = account.provider.toUpperCase();
  const rawAccessToken = account.access_token;

  // Fetch real profile metadata — non-fatal if the API call fails
  let username    = user.name ?? user.email?.split('@')[0] ?? 'unknown';
  let displayName: string | null = user.name ?? null;
  let profileUrl:  string | null = null;
  let avatarUrl:   string | null = user.image ?? null;

  try {
    const connector = getConnector(account.provider);
    const profile = await connector.getProfile({ accessToken: rawAccessToken });
    username    = profile.username;
    displayName = profile.displayName ?? null;
    profileUrl  = profile.profileUrl  ?? null;
    avatarUrl   = profile.avatarUrl   ?? null;
  } catch (err) {
    logger.warn({ err, provider: account.provider }, 'autoSyncSocialAccount: getProfile failed; using session defaults');
  }

  const storedAccessToken  = encrypt(rawAccessToken);
  const storedRefreshToken = account.refresh_token ? encrypt(account.refresh_token) : null;
  const tokenExpiresAt     = account.expires_at ? new Date(account.expires_at * 1000) : null;
  const now                = new Date();

  const existingSnap = await socialAccountsRef
    .where('userId', '==', userId)
    .where('platform', '==', platform)
    .limit(1)
    .get();

  // Find an exact platformUserId match within the results (avoids 3-field composite index)
  const exactMatch = existingSnap.docs.find(
    (d) => d.data().platformUserId === account.providerAccountId
  );

  if (exactMatch) {
    await exactMatch.ref.update({
      username, displayName, profileUrl, avatarUrl,
      accessToken: storedAccessToken,
      refreshToken: storedRefreshToken,
      tokenExpiresAt,
      updatedAt: now,
    });
  } else {
    await socialAccountsRef.doc(generateId()).set({
      userId,
      platform,
      platformUserId: account.providerAccountId,
      username, displayName, profileUrl, avatarUrl,
      accessToken:     storedAccessToken,
      refreshToken:    storedRefreshToken,
      tokenExpiresAt,
      scopes:          account.scope ?? null,
      metadata:        null,
      connectedAt:     now,
      updatedAt:       now,
    });
  }

  logger.info({ userId, platform, username }, 'auth:event - auto-synced socialAccount');
}

/**
 * Build NextAuth options.
 *
 * @param pendingLinkUserId  When set (decoded from the signed
 *   `pending-link-user-id` cookie), the Firestore adapter will attach the
 *   incoming OAuth account to this existing user instead of creating a new one.
 *   Pass `null` / `undefined` for normal sign-in flows.
 */
export function buildAuthOptions(pendingLinkUserId?: string | null): NextAuthOptions {
  return {
  adapter: createFirestoreAdapter(pendingLinkUserId),
  providers: [
    // ─── Email / Password ──────────────────────────────────────────
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();
        const snap = await usersRef.where('email', '==', email).limit(1).get();
        if (snap.empty) return null;

        const doc = snap.docs[0];
        const user = doc.data();

        if (!user.passwordHash) return null; // OAuth-only account
        if (!verifyPassword(credentials.password, user.passwordHash)) return null;

        return {
          id: doc.id,
          name: user.name || null,
          email: user.email,
          image: user.image || null,
        };
      },
    }),

    // ─── Google OAuth2 (optional — only if env vars are set) ───────
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          {
            id: 'google',
            name: 'Google',
            type: 'oauth' as const,
            authorization: {
              url: 'https://accounts.google.com/o/oauth2/v2/auth',
              params: { scope: 'openid email profile', prompt: 'consent', access_type: 'offline' },
            },
            token: 'https://oauth2.googleapis.com/token',
            userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            profile(profile: any) {
              return {
                id: profile.sub,
                name: profile.name,
                email: profile.email,
                image: profile.picture,
              };
            },
          },
        ]
      : []),

    // ─── Facebook OAuth2 (optional) ────────────────────────────────
    ...(process.env.FACEBOOK_CLIENT_ID
      ? [
          {
            id: 'facebook',
            name: 'Facebook',
            type: 'oauth' as const,
            authorization: {
              url: 'https://www.facebook.com/v18.0/dialog/oauth',
              params: { scope: 'email,public_profile' },
            },
            token: 'https://graph.facebook.com/v18.0/oauth/access_token',
            userinfo: {
              url: 'https://graph.facebook.com/v18.0/me',
              params: { fields: 'id,name,email,picture' },
            },
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
            profile(profile: any) {
              return {
                id: profile.id,
                name: profile.name,
                email: profile.email ?? null,
                image: profile.picture?.data?.url ?? null,
              };
            },
          },
        ]
      : []),

    // ─── Reddit OAuth2 (optional) ──────────────────────────────────
    ...(process.env.REDDIT_CLIENT_ID
      ? [
          {
            id: 'reddit',
            name: 'Reddit',
            type: 'oauth' as const,
            authorization: {
              url: 'https://www.reddit.com/api/v1/authorize',
              params: {
                scope: 'identity submit read mysubreddits flair',
                response_type: 'code',
                duration: 'permanent',
              },
            },
            token: {
              url: 'https://www.reddit.com/api/v1/access_token',
              async request({ params, provider }: any) {
                const body = new URLSearchParams({
                  grant_type: 'authorization_code',
                  code: params.code as string,
                  redirect_uri: provider.callbackUrl,
                });
                const res = await fetch('https://www.reddit.com/api/v1/access_token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${Buffer.from(
                      `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
                    ).toString('base64')}`,
                  },
                  body,
                });
                const tokens = await res.json();
                return { tokens };
              },
            },
            userinfo: {
              url: 'https://oauth.reddit.com/api/v1/me',
              async request({ tokens }: any) {
                const res = await fetch('https://oauth.reddit.com/api/v1/me', {
                  headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'SocialHub/1.0' },
                });
                return res.json();
              },
            },
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            profile(profile: any) {
              return {
                id: profile.id,
                name: profile.name,
                email: null,
                image: profile.icon_img?.split('?')[0] || null,
              };
            },
          },
        ]
      : []),

    // ─── Twitter / X OAuth 2.0 (optional) ─────────────────────────
    // Uses OAuth 2.0 with PKCE which hits v2 endpoints (works on Free tier).
    // Requires a real HTTPS callback URL (deploy to Netlify/Vercel).
    ...(process.env.TWITTER_CLIENT_ID
      ? [
          TwitterProvider({
            clientId: process.env.TWITTER_CLIENT_ID!,
            clientSecret: process.env.TWITTER_CLIENT_SECRET!,
            version: '2.0',
          }),
        ]
      : []),

    // ─── LinkedIn OAuth2 (optional) ───────────────────────────────
    ...(process.env.LINKEDIN_CLIENT_ID
      ? [
          {
            id: 'linkedin',
            name: 'LinkedIn',
            type: 'oauth' as const,
            authorization: {
              url: 'https://www.linkedin.com/oauth/v2/authorization',
              params: { scope: 'openid profile email w_member_social' },
            },
            token: 'https://www.linkedin.com/oauth/v2/accessToken',
            userinfo: 'https://api.linkedin.com/v2/userinfo',
            clientId: process.env.LINKEDIN_CLIENT_ID,
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
            profile(profile: any) {
              return {
                id: profile.sub,
                name: profile.name,
                email: profile.email,
                image: profile.picture,
              };
            },
          },
        ]
      : []),

    // ─── Instagram (Meta) OAuth2 (optional) ───────────────────────
    ...(process.env.INSTAGRAM_CLIENT_ID
      ? [
          {
            id: 'instagram',
            name: 'Instagram',
            type: 'oauth' as const,
            authorization: {
              url: 'https://www.facebook.com/v18.0/dialog/oauth',
              params: {
                scope: 'instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list',
              },
            },
            token: 'https://graph.facebook.com/v18.0/oauth/access_token',
            userinfo: {
              url: 'https://graph.facebook.com/v18.0/me',
              params: { fields: 'id,name,email' },
            },
            clientId: process.env.INSTAGRAM_CLIENT_ID,
            clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
            profile(profile: any) {
              return {
                id: profile.id,
                name: profile.name,
                email: profile.email ?? null,
                image: null,
              };
            },
          },
        ]
      : []),
  ],

  callbacks: {
    async signIn({ account }) {
      if (account && account.access_token) {
        try {
          logger.info({ provider: account.provider }, 'User signing in via platform');
        } catch (err) {
          logger.error({ err }, 'Error during sign-in callback');
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // On initial sign-in, persist user id into the JWT
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image ?? undefined;
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        try {
          const userDoc = await usersRef.doc(token.sub).get();
          const userData = userDoc.data();
          if (userData) {
            (session.user as any).plan = userData.plan || 'FREE';
            (session.user as any).timezone = userData.timezone || 'UTC';
          }
        } catch {
          // Session still works without plan/timezone
        }
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },

  events: {
    // The custom adapter already seeds plan/timezone on createUser.
    // This event fires as a safety net (e.g. if a different adapter path runs).
    async createUser({ user }) {
      await usersRef.doc(user.id).set(
        { plan: 'FREE', timezone: 'UTC' },
        { merge: true }
      );
      logger.info({ userId: user.id, email: user.email }, 'auth:event - user created');
    },

    // Auto-populate socialAccounts whenever an OAuth sign-in completes.
    // This ensures that signing in with X/Twitter (or any OAuth provider)
    // immediately shows the account on the Connected Accounts page without
    // the user needing to click "Connect" manually.
    async signIn({ user, account }) {
      if (!account || account.provider === 'credentials' || !user?.id) return;
      try {
        await autoSyncSocialAccount(user.id, account as any, user);
      } catch (err) {
        // Never block sign-in — just log
        logger.error({ err, provider: account.provider, userId: user.id }, 'auth:event - autoSyncSocialAccount failed');
      }
    },
  },
  }; // end return
}

/**
 * Static singleton used by helpers that don't have per-request context
 * (e.g. getServerSession calls from server components / API routes that
 *  don't need the "connect" cookie — the cookie is only needed during the
 *  OAuth callback itself).
 */
export const authOptions = buildAuthOptions();
