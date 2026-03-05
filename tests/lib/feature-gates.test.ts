/**
 * Feature gates test stubs.
 * These require mocking Prisma and are structured as integration-ready stubs.
 */

// Mock Prisma before imports
jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    socialAccount: { count: jest.fn() },
    post: { count: jest.fn() },
    aiUsage: { count: jest.fn() },
  },
}));

import { checkFeatureAccess, getUsageSummary } from '@/lib/stripe/feature-gates';
import { prisma } from '@/lib/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('checkFeatureAccess', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should allow any feature for PREMIUM users', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'PREMIUM' });

    const result = await checkFeatureAccess('user-1', 'reddit_rules');
    expect(result).toEqual({ allowed: true });
  });

  it('should deny premium-only features for FREE users', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'FREE' });

    const result = await checkFeatureAccess('user-1', 'csv_export');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Premium');
  });

  it('should return not allowed when user not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await checkFeatureAccess('nonexistent', 'reddit_rules');
    expect(result).toEqual({ allowed: false, reason: 'User not found' });
  });

  it('should deny team_collaboration for FREE users', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'FREE' });

    const result = await checkFeatureAccess('user-1', 'team_collaboration');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Team collaboration');
  });

  it('should deny priority_queue for FREE users', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'FREE' });

    const result = await checkFeatureAccess('user-1', 'priority_queue');
    expect(result.allowed).toBe(false);
  });
});

describe('getUsageSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return usage counts for a user', async () => {
    (mockPrisma.socialAccount.count as jest.Mock).mockResolvedValue(2);
    (mockPrisma.post.count as jest.Mock).mockResolvedValue(15);
    (mockPrisma.aiUsage.count as jest.Mock).mockResolvedValue(5);

    const summary = await getUsageSummary('user-1');

    expect(summary.accounts.used).toBe(2);
    expect(summary.posts.used).toBe(15);
    expect(summary.aiCaptions.used).toBe(5);
    expect(summary.accounts.limit).toBeGreaterThan(0);
    expect(summary.posts.limit).toBeGreaterThan(0);
    expect(summary.aiCaptions.limit).toBeGreaterThan(0);
  });

  it('should return zero usage for new users', async () => {
    (mockPrisma.socialAccount.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.post.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.aiUsage.count as jest.Mock).mockResolvedValue(0);

    const summary = await getUsageSummary('new-user');

    expect(summary.accounts.used).toBe(0);
    expect(summary.posts.used).toBe(0);
    expect(summary.aiCaptions.used).toBe(0);
  });
});
