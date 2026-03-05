import type { PostContent, PostMetrics, PlatformTokens } from '@/types';

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  publishedUrl?: string;
  error?: string;
}

export interface PlatformProfile {
  platformUserId: string;
  username: string;
  displayName?: string;
  profileUrl?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Abstract base class for all social media platform connectors.
 * Each platform implements its own posting, metrics, and token refresh logic.
 */
export abstract class BasePlatformConnector {
  abstract readonly platform: string;

  /** Publish content to the platform. */
  abstract publish(tokens: PlatformTokens, content: PostContent): Promise<PublishResult>;

  /** Fetch engagement metrics for a published post. */
  abstract fetchMetrics(tokens: PlatformTokens, platformPostId: string): Promise<PostMetrics>;

  /** Refresh an expired access token. Returns new tokens. */
  abstract refreshAccessToken(tokens: PlatformTokens): Promise<PlatformTokens>;

  /** Fetch the authenticated user's profile info. */
  abstract getProfile(tokens: PlatformTokens): Promise<PlatformProfile>;

  /** Delete a post (if supported). */
  async deletePost(_tokens: PlatformTokens, _platformPostId: string): Promise<boolean> {
    return false;
  }

  /**
   * Helper: make an authenticated API request with standard error handling.
   */
  protected async apiRequest<T>(
    url: string,
    options: RequestInit & { accessToken: string }
  ): Promise<T> {
    const { accessToken, ...init } = options;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new PlatformApiError(this.platform, res.status, text);
    }

    return res.json() as T;
  }
}

export class PlatformApiError extends Error {
  constructor(
    public readonly platform: string,
    public readonly statusCode: number,
    public readonly body: string
  ) {
    super(`${platform} API error (${statusCode}): ${body.substring(0, 200)}`);
    this.name = 'PlatformApiError';
  }
}
