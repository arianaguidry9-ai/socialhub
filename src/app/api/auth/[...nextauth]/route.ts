import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { buildAuthOptions } from '@/lib/auth/options';
import { LINK_COOKIE_NAME, verifyLinkCookie } from '@/lib/auth/link-cookie';

/**
 * Per-request handler.
 *
 * Reading the signed `pending-link-user-id` cookie here — before passing
 * options to NextAuth — lets the custom Firestore adapter know whether to:
 *   (a) create a brand-new user  (no cookie → normal sign-in)
 *   (b) attach the incoming OAuth account to an existing user  (cookie set)
 *
 * The cookie is set by GET /api/accounts/link-start when the user clicks
 * "Connect <Platform>" from the dashboard while already logged in.
 */
async function handler(req: NextRequest, context: unknown) {
  const rawCookie = req.cookies.get(LINK_COOKIE_NAME)?.value ?? null;
  const pendingLinkUserId = verifyLinkCookie(rawCookie);

  // Log callback requests for debugging
  const { pathname, searchParams } = req.nextUrl;
  if (pathname.includes('/callback/')) {
    console.log('[auth] callback hit:', pathname, 'code:', searchParams.get('code') ? 'present' : 'absent', 'error:', searchParams.get('error') ?? 'none');
  }

  try {
    return await NextAuth(buildAuthOptions(pendingLinkUserId))(req as never, context);
  } catch (err) {
    console.error('[auth] NextAuth handler error:', err);
    throw err;
  }
}

export { handler as GET, handler as POST };
