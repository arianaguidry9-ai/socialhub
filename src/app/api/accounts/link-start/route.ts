/**
 * GET /api/accounts/link-start
 *
 * Called by the dashboard "Connect <Platform>" button before initiating the
 * OAuth flow.  Sets a short-lived, HMAC-signed httpOnly cookie that carries
 * the current user's ID into the NextAuth callback.  The custom Firestore
 * adapter reads this cookie to attach the incoming OAuth account to the
 * existing user instead of creating a duplicate.
 *
 * Security notes:
 * - The cookie is httpOnly (not readable by JS).
 * - The value is HMAC-SHA256 signed with NEXTAUTH_SECRET; tampering is detected.
 * - TTL is 5 minutes; the OAuth round-trip normally takes < 60 s.
 * - sameSite=lax prevents CSRF while still allowing the OAuth redirect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { signLinkCookie, LINK_COOKIE_NAME } from '@/lib/auth/link-cookie';
import { logger } from '@/lib/logger';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieValue = signLinkCookie(session.user.id);

  logger.info({ userId: session.user.id }, 'auth:link-start - pending link cookie set');

  const res = NextResponse.json({ ok: true });
  res.cookies.set(LINK_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 300, // 5 minutes
    path: '/',
  });
  return res;
}
