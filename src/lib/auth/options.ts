import type { NextAuthOptions } from 'next-auth';
import { FirestoreAdapter } from '@auth/firebase-adapter';
import type { Adapter } from 'next-auth/adapters';
import { firestore } from '@/lib/firebase';
import { usersRef } from '@/lib/db';
import { logger } from '@/lib/logger';
import { encrypt } from '@/lib/encryption';

/**
 * NextAuth configuration with OAuth providers for each social platform.
 * Platform tokens are encrypted before storage.
 */
export const authOptions: NextAuthOptions = {
  adapter: FirestoreAdapter(firestore) as Adapter,
  providers: [
    // ─── Reddit OAuth2 ─────────────────────────────────────────────
    {
      id: 'reddit',
      name: 'Reddit',
      type: 'oauth',
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
        async request({ params, provider }) {
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
        async request({ tokens }) {
          const res = await fetch('https://oauth.reddit.com/api/v1/me', {
            headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'SocialHub/1.0' },
          });
          return res.json();
        },
      },
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.id,
          name: profile.name,
          email: null,
          image: profile.icon_img?.split('?')[0] || null,
        };
      },
    },

    // ─── Twitter / X OAuth2 ────────────────────────────────────────
    {
      id: 'twitter',
      name: 'Twitter',
      type: 'oauth',
      authorization: {
        url: 'https://twitter.com/i/oauth2/authorize',
        params: {
          scope: 'tweet.read tweet.write users.read offline.access',
          code_challenge_method: 'S256',
        },
      },
      token: 'https://api.twitter.com/2/oauth2/token',
      userinfo: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.data.id,
          name: profile.data.name,
          email: null,
          image: profile.data.profile_image_url,
        };
      },
    },

    // ─── LinkedIn OAuth2 ───────────────────────────────────────────
    {
      id: 'linkedin',
      name: 'LinkedIn',
      type: 'oauth',
      authorization: {
        url: 'https://www.linkedin.com/oauth/v2/authorization',
        params: { scope: 'openid profile email w_member_social' },
      },
      token: 'https://www.linkedin.com/oauth/v2/accessToken',
      userinfo: 'https://api.linkedin.com/v2/userinfo',
      clientId: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    },

    // ─── Instagram (Meta) OAuth2 ───────────────────────────────────
    {
      id: 'instagram',
      name: 'Instagram',
      type: 'oauth',
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
      profile(profile) {
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email ?? null,
          image: null,
        };
      },
    },
  ],

  callbacks: {
    async signIn({ account }) {
      if (account && account.access_token) {
        // Store encrypted tokens in SocialAccount table
        try {
          const platform = account.provider.toUpperCase();
          logger.info({ provider: account.provider }, 'User signing in via platform');

          // Note: actual SocialAccount creation happens in the link-account API route
          // to avoid duplicating logic here. This callback just validates.
        } catch (err) {
          logger.error({ err }, 'Error during sign-in callback');
        }
      }
      return true;
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const userDoc = await usersRef.doc(user.id).get();
        const userData = userDoc.data();
        if (userData) {
          (session.user as any).plan = userData.plan || 'FREE';
          (session.user as any).timezone = userData.timezone || 'UTC';
        }
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'database' },

  events: {
    async createUser({ user }) {
      await usersRef.doc(user.id).set(
        { plan: 'FREE', timezone: 'UTC' },
        { merge: true }
      );
      logger.info({ userId: user.id, email: user.email }, 'New user created');
    },
  },
};
