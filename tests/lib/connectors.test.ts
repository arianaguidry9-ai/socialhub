/**
 * Platform connector test stubs.
 * Tests the connector registry and PlatformApiError class.
 * Full connector tests require mocking fetch for each platform's API.
 */

import { PlatformApiError } from '@/lib/connectors/base';

jest.mock('@/lib/db', () => ({}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('PlatformApiError', () => {
  it('should format error message with platform and status', () => {
    const err = new PlatformApiError('twitter', 403, 'Forbidden');
    expect(err.message).toContain('twitter');
    expect(err.message).toContain('403');
    expect(err.message).toContain('Forbidden');
    expect(err.name).toBe('PlatformApiError');
  });

  it('should truncate long error bodies', () => {
    const longBody = 'x'.repeat(500);
    const err = new PlatformApiError('reddit', 500, longBody);
    // Message should contain at most 200 chars of body
    expect(err.message.length).toBeLessThan(longBody.length);
  });

  it('should expose platform and statusCode properties', () => {
    const err = new PlatformApiError('linkedin', 401, 'Unauthorized');
    expect(err.platform).toBe('linkedin');
    expect(err.statusCode).toBe(401);
    expect(err.body).toBe('Unauthorized');
  });
});

describe('Connector registry', () => {
  // Using dynamic import to handle module-level side effects
  it('should export getConnector function', async () => {
    const registry = await import('@/lib/connectors/index');
    expect(typeof registry.getConnector).toBe('function');
  });

  it('should return a connector for supported platforms', async () => {
    const { getConnector } = await import('@/lib/connectors/index');

    const twitter = getConnector('twitter');
    expect(twitter).toBeDefined();
    expect(twitter.platform).toBe('twitter');

    const reddit = getConnector('reddit');
    expect(reddit).toBeDefined();
    expect(reddit.platform).toBe('reddit');
  });

  it('should throw for unsupported platforms', async () => {
    const { getConnector } = await import('@/lib/connectors/index');

    expect(() => getConnector('tiktok' as any)).toThrow();
  });
});
