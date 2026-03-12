import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { socialAccountsRef } from '@/lib/db';
import { logger } from '@/lib/logger';

/** DELETE /api/accounts/[id] — Disconnect a social account. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const doc = await socialAccountsRef.doc(params.id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Ensure the account belongs to the current user
    const data = doc.data();
    if (data?.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await socialAccountsRef.doc(params.id).delete();
    logger.info({ userId: session.user.id, accountId: params.id }, 'Social account disconnected');

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to disconnect account');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
