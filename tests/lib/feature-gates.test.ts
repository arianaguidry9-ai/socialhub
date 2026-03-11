/**
 * Feature gates test stubs.
 * These require mocking Firestore and are structured as integration-ready stubs.
 */

const mockGet = jest.fn();
const mockDoc = jest.fn().mockReturnValue({ get: mockGet });

jest.mock('@/lib/db', () => ({
  usersRef: { doc: mockDoc },
  socialAccountsRef: { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 0 }) }) },
  postsRef: { where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 0 }) }) }) }) },
  aiUsageRef: { where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 0 }) }) }) }) },
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { checkFeatureAccess, getUsageSummary } from '@/lib/stripe/feature-gates';

describe('checkFeatureAccess', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should allow any feature for PREMIUM users', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ plan: 'PREMIUM' }) });

    const result = await checkFeatureAccess('user-1', 'reddit_rules');
    expect(result).toEqual({ allowed: true });
  });

  it('should deny premium-only features for FREE users', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ plan: 'FREE' }) });

    const result = await checkFeatureAccess('user-1', 'csv_export');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Premium');
  });

  it('should return not allowed when user not found', async () => {
    mockGet.mockResolvedValue({ exists: false, data: () => undefined });

    const result = await checkFeatureAccess('nonexistent', 'reddit_rules');
    expect(result).toEqual({ allowed: false, reason: 'User not found' });
  });

  it('should deny team_collaboration for FREE users', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ plan: 'FREE' }) });

    const result = await checkFeatureAccess('user-1', 'team_collaboration');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Team collaboration');
  });

  it('should deny priority_queue for FREE users', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ plan: 'FREE' }) });

    const result = await checkFeatureAccess('user-1', 'priority_queue');
    expect(result.allowed).toBe(false);
  });
});

describe('getUsageSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return usage counts for a user', async () => {
    const { socialAccountsRef, postsRef, aiUsageRef } = require('@/lib/db');

    // Override the chained where().get() to return a snapshot with size
    socialAccountsRef.where = jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 2 }) });
    postsRef.where = jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 15 }) }) }) });
    aiUsageRef.where = jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 5 }) }) }) });

    const summary = await getUsageSummary('user-1');

    expect(summary.accounts.used).toBe(2);
    expect(summary.posts.used).toBe(15);
    expect(summary.aiCaptions.used).toBe(5);
    expect(summary.accounts.limit).toBeGreaterThan(0);
    expect(summary.posts.limit).toBeGreaterThan(0);
    expect(summary.aiCaptions.limit).toBeGreaterThan(0);
  });

  it('should return zero usage for new users', async () => {
    const { socialAccountsRef, postsRef, aiUsageRef } = require('@/lib/db');

    socialAccountsRef.where = jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 0 }) });
    postsRef.where = jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 0 }) }) }) });
    aiUsageRef.where = jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ size: 0 }) }) }) });

    const summary = await getUsageSummary('new-user');

    expect(summary.accounts.used).toBe(0);
    expect(summary.posts.used).toBe(0);
    expect(summary.aiCaptions.used).toBe(0);
  });
});
