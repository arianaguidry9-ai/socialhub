import { getServerSession } from 'next-auth';
import { authOptions } from './options';
import { prisma } from '@/lib/db';
import type { UserPlan } from '@/types';

const DEBUG_USER = {
  id: 'debug-user-001',
  name: 'Debug User',
  email: 'debug@socialhub.dev',
  plan: 'premium' as UserPlan,
  image: null,
  timezone: 'America/New_York',
};

const DEBUG_SESSION = {
  user: DEBUG_USER,
  expires: new Date(Date.now() + 86400_000).toISOString(),
};

/** Get the current authenticated session (server-side). */
export async function getSession() {
  if (process.env.DEBUG_AUTH === 'true') {
    return DEBUG_SESSION;
  }
  return getServerSession(authOptions);
}

/** Get the current user from the session or throw 401. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user as { id: string; email: string; name: string; plan: UserPlan };
}

/** Check if user has premium plan. */
export async function isPremium(userId: string): Promise<boolean> {
  if (process.env.DEBUG_AUTH === 'true') {
    return true;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  return user?.plan === 'PREMIUM';
}
