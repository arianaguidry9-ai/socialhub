/**
 * link-cookie.ts
 *
 * Utilities for the signed, httpOnly "pending-link-user-id" cookie that threads
 * the current user's Firestore ID through the OAuth redirect flow so the adapter
 * can attach a new provider to an existing account instead of creating a new user.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
 * TTL:    5 minutes (enforced by the ts field in the payload)
 */

import { createHmac, timingSafeEqual } from 'crypto';

export const LINK_COOKIE_NAME = 'pending-link-user-id';
const MAX_AGE_MS = 5 * 60 * 1_000; // 5 minutes

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET env var is required');
  return s;
}

/** Create a signed cookie value that encodes userId + timestamp. */
export function signLinkCookie(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify integrity + TTL of the cookie value.
 * Returns the userId if valid, null otherwise.
 */
export function verifyLinkCookie(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const dot = value.lastIndexOf('.');
    if (dot === -1) return null;

    const payload = value.slice(0, dot);
    const sig = value.slice(dot + 1);

    const expectedSig = createHmac('sha256', secret()).update(payload).digest('base64url');

    // Timing-safe comparison prevents length-extension / timing attacks
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    const { userId, ts } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId: string;
      ts: number;
    };

    if (Date.now() - ts > MAX_AGE_MS) return null;

    return userId;
  } catch {
    return null;
  }
}
