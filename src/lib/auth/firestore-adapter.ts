/**
 * firestore-adapter.ts
 *
 * Custom NextAuth Adapter backed by Firebase Firestore.
 *
 * Key design decisions
 * ─────────────────────
 * 1. One User, Many Accounts
 *    Every OAuth provider is stored as a separate document in the `accounts`
 *    collection.  Multiple accounts can point at the same `users` document.
 *
 * 2. allowDangerousEmailAccountLinking (equivalent)
 *    `getUserByEmail` always returns null.  This prevents NextAuth's core
 *    from throwing `OAuthAccountNotLinked` when the same e-mail address has
 *    already been used with a different provider.
 *    Instead, `createUser` performs the deduplication: if a document with the
 *    same e-mail already exists it is returned as-is, then `linkAccount` wires
 *    up the new provider to that existing userId.
 *
 * 3. "Connect while logged in" flow
 *    If `pendingLinkUserId` is supplied (read from the signed httpOnly cookie
 *    set by /api/accounts/link-start), `createUser` short-circuits and returns
 *    that existing user unconditionally.  NextAuth then calls `linkAccount`
 *    with the correct userId — no duplicate user is ever created.
 *
 * 4. Token encryption
 *    All sensitive OAuth tokens are encrypted with AES-256-GCM before they
 *    reach Firestore (via the project's existing `encrypt` helper).
 */

import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters';
import { usersRef, accountsRef, generateId, firestore } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toAdapterUser(id: string, data: Record<string, unknown>): AdapterUser {
  return {
    id,
    email: (data.email as string) ?? '',
    name: (data.name as string | null) ?? null,
    image: (data.image as string | null) ?? null,
    emailVerified: data.emailVerified ? new Date(data.emailVerified as string) : null,
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * @param pendingLinkUserId  When provided, `createUser` returns this existing
 *   user instead of creating a new one.  Pass the value decoded from the
 *   signed `pending-link-user-id` httpOnly cookie.
 */
export function createFirestoreAdapter(pendingLinkUserId?: string | null): Adapter {
  return {
    // ── User CRUD ────────────────────────────────────────────────────────────

    async createUser(user: Omit<AdapterUser, 'id'>) {
      // --- Connect-while-logged-in flow ---
      if (pendingLinkUserId) {
        try {
          const snap = await usersRef.doc(pendingLinkUserId).get();
          if (snap.exists) {
            logger.info({ userId: pendingLinkUserId }, 'auth:adapter - connect flow: returning existing user');
            return toAdapterUser(snap.id, snap.data()!);
          }
        } catch (err) {
          logger.warn({ err, pendingLinkUserId }, 'auth:adapter - createUser: pending-link lookup failed');
        }
      }

      // --- E-mail deduplication (allowDangerousEmailAccountLinking) ---
      const emailLower = (user.email ?? '').toLowerCase().trim();
      if (emailLower) {
        try {
          const existing = await usersRef.where('email', '==', emailLower).limit(1).get();
          if (!existing.empty) {
            logger.info({ email: emailLower }, 'auth:adapter - email match: merging providers into existing user');
            return toAdapterUser(existing.docs[0].id, existing.docs[0].data());
          }
        } catch (err) {
          logger.warn({ err, email: emailLower }, 'auth:adapter - createUser: email dedup query failed; will create new user');
        }
      }

      // --- Create new user ---
      const id = generateId();
      const now = new Date().toISOString();
      const data = {
        email: emailLower || null,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        plan: 'FREE',
        timezone: 'UTC',
        createdAt: now,
        updatedAt: now,
      };

      try {
        await usersRef.doc(id).set(data);
        logger.info({ userId: id, email: emailLower }, 'auth:adapter - new user created in Firestore');
      } catch (err) {
        // Firestore write failed but we still return a valid user so the JWT
        // can be issued and the user lands on the dashboard.  The write will
        // be retried on next sign-in via the email-dedup path.
        logger.error({ err, userId: id, email: emailLower }, 'auth:adapter - createUser: Firestore write failed; user receives in-memory session');
      }

      return toAdapterUser(id, data);
    },

    async getUser(id) {
      const snap = await usersRef.doc(id).get();
      if (!snap.exists) return null;
      return toAdapterUser(snap.id, snap.data()!);
    },

    /**
     * Always returns null for OAuth flows.
     *
     * Returning an existing user here causes NextAuth's core to throw
     * `OAuthAccountNotLinked`.  We handle the deduplication in `createUser`
     * instead, which is called only when `getUserByAccount` returns null.
     *
     * For Credentials auth the lookup is done inside `authorize()` directly,
     * so this method is never reached for that flow.
     */
    async getUserByEmail(_email) {
      return null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      try {
        const snap = await accountsRef
          .where('provider', '==', provider)
          .where('providerAccountId', '==', providerAccountId)
          .limit(1)
          .get();
        if (snap.empty) return null;

        const userId: string = snap.docs[0].data().userId;
        const userSnap = await usersRef.doc(userId).get();
        if (!userSnap.exists) return null;
        return toAdapterUser(userSnap.id, userSnap.data()!);
      } catch (err) {
        // Treat transient Firestore errors as "account not found".
        // NextAuth will then call createUser → linkAccount, which will
        // upsert the account document on the next successful connection.
        logger.warn({ err, provider, providerAccountId }, 'auth:adapter - getUserByAccount failed; treating as not found');
        return null;
      }
    },

    async updateUser(user) {
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (user.name !== undefined) updates.name = user.name;
      if (user.email !== undefined) updates.email = user.email.toLowerCase();
      if (user.image !== undefined) updates.image = user.image;
      if (user.emailVerified !== undefined) {
        updates.emailVerified = user.emailVerified?.toISOString() ?? null;
      }
      await usersRef.doc(user.id).update(updates);
      const snap = await usersRef.doc(user.id).get();
      return toAdapterUser(snap.id, snap.data()!);
    },

    async deleteUser(userId) {
      const linked = await accountsRef.where('userId', '==', userId).get();
      const batch = firestore.batch();
      linked.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(usersRef.doc(userId));
      await batch.commit();
    },

    // ── Account linking ──────────────────────────────────────────────────────

    async linkAccount(account: AdapterAccount) {
      const data: Record<string, unknown> = {
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        updatedAt: new Date().toISOString(),
      };

      // Encrypt all sensitive tokens before they touch Firestore
      if (account.access_token)  data.access_token  = encrypt(account.access_token);
      if (account.refresh_token) data.refresh_token = encrypt(account.refresh_token);
      if (account.expires_at)    data.expires_at    = account.expires_at;
      if (account.token_type)    data.token_type    = account.token_type;
      if (account.scope)         data.scope         = account.scope;
      if (account.id_token)      data.id_token      = account.id_token;
      if (account.session_state) data.session_state = account.session_state;

      try {
        // Check for existing row so we can update (re-auth) rather than dupe
        const existing = await accountsRef
          .where('provider', '==', account.provider)
          .where('providerAccountId', '==', account.providerAccountId)
          .limit(1)
          .get();

        if (!existing.empty) {
          await existing.docs[0].ref.update(data);
          logger.info({ userId: account.userId, provider: account.provider }, 'auth:adapter - OAuth account re-linked');
        } else {
          await accountsRef.doc(generateId()).set(data);
          logger.info({ userId: account.userId, provider: account.provider }, 'auth:adapter - OAuth account linked');
        }
      } catch (err) {
        // Non-fatal: the JWT is already being built. The account record will
        // be written on the next sign-in when getUserByAccount returns null.
        logger.error({ err, userId: account.userId, provider: account.provider }, 'auth:adapter - linkAccount: Firestore write failed');
      }

      return account;
    },

    async unlinkAccount({ provider, providerAccountId }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>) {
      const snap = await accountsRef
        .where('provider', '==', provider)
        .where('providerAccountId', '==', providerAccountId)
        .limit(1)
        .get();
      if (!snap.empty) await snap.docs[0].ref.delete();
    },

    // ── Sessions — not used with JWT strategy ────────────────────────────────
    async createSession(session)          { return session as never; },
    async getSessionAndUser(_token)       { return null; },
    async updateSession(session)          { return session as never; },
    async deleteSession(_sessionToken)    {},

    // ── Verification tokens — placeholder for future magic-link support ──────
    async createVerificationToken(token) { return token; },
    async useVerificationToken(_params)  { return null; },
  };
}
