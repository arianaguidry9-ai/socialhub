import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    plan: session.user.plan ?? 'FREE',
  });
}
