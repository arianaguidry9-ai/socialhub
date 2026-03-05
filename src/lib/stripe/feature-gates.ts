import { prisma } from '@/lib/db';
import { FREE_TIER_LIMITS, PREMIUM_TIER_LIMITS } from '@/types';
import { logger } from '@/lib/logger';

type Feature =
  | 'unlimited_accounts'
  | 'unlimited_posts'
  | 'full_analytics'
  | 'unlimited_ai'
  | 'reddit_rules'
  | 'priority_queue'
  | 'team_collaboration'
  | 'csv_export';

/**
 * Check if a user is allowed to use a premium feature.
 * Returns { allowed: boolean, reason?: string }.
 */
export async function checkFeatureAccess(
  userId: string,
  feature: Feature
): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  if (user.plan === 'PREMIUM') {
    return { allowed: true };
  }

  // Free tier checks
  switch (feature) {
    case 'unlimited_accounts':
      return { allowed: false, reason: `Free tier limited to ${FREE_TIER_LIMITS.maxAccounts} accounts` };
    case 'unlimited_posts':
      return { allowed: false, reason: `Free tier limited to ${FREE_TIER_LIMITS.maxPostsPerMonth} posts/month` };
    case 'full_analytics':
      return { allowed: false, reason: `Free tier analytics limited to ${FREE_TIER_LIMITS.analyticsWindowDays} days` };
    case 'unlimited_ai':
      return { allowed: false, reason: `Free tier limited to ${FREE_TIER_LIMITS.maxAiCaptionsPerMonth} AI captions/month` };
    case 'reddit_rules':
      return { allowed: false, reason: 'Reddit rule analysis requires Premium' };
    case 'priority_queue':
      return { allowed: false, reason: 'Priority queue requires Premium' };
    case 'team_collaboration':
      return { allowed: false, reason: 'Team collaboration requires Premium' };
    case 'csv_export':
      return { allowed: false, reason: 'CSV export requires Premium' };
    default:
      return { allowed: true };
  }
}

/**
 * Get the current usage counts for a free-tier user.
 */
export async function getUsageSummary(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [accountCount, postCount, aiCaptionCount] = await Promise.all([
    prisma.socialAccount.count({ where: { userId } }),
    prisma.post.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
        status: { not: 'DRAFT' },
      },
    }),
    prisma.aiUsage.count({
      where: {
        userId,
        feature: 'CAPTION',
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  return {
    accounts: { used: accountCount, limit: FREE_TIER_LIMITS.maxAccounts },
    posts: { used: postCount, limit: FREE_TIER_LIMITS.maxPostsPerMonth },
    aiCaptions: { used: aiCaptionCount, limit: FREE_TIER_LIMITS.maxAiCaptionsPerMonth },
  };
}
