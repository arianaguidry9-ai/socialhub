import { BasePlatformConnector, PlatformApiError } from './base';
import type { PublishResult, PlatformProfile } from './base';
import type { PostContent, PostMetrics, PlatformTokens } from '@/types';
import { logger } from '@/lib/logger';

const GRAPH_API = 'https://graph.facebook.com/v18.0';

/**
 * Instagram platform connector via Meta Graph API.
 * Supports feed posts, carousels, and reels for Instagram Business/Creator accounts.
 */
export class InstagramConnector extends BasePlatformConnector {
  readonly platform = 'instagram';

  /** Get the Instagram Business Account ID from the connected Facebook Page. */
  private async getIgBusinessAccountId(tokens: PlatformTokens): Promise<string> {
    // Get pages the user manages
    const pages = await this.apiRequest<any>(`${GRAPH_API}/me/accounts?fields=instagram_business_account`, {
      accessToken: tokens.accessToken,
    });

    const page = pages.data?.find((p: any) => p.instagram_business_account);
    if (!page?.instagram_business_account?.id) {
      throw new PlatformApiError('instagram', 400, 'No Instagram Business account linked to any Facebook Page');
    }

    return page.instagram_business_account.id;
  }

  async publish(tokens: PlatformTokens, content: PostContent): Promise<PublishResult> {
    const igAccountId = await this.getIgBusinessAccountId(tokens);

    // Step 1: Create a media container
    const containerParams: Record<string, string> = {
      caption: content.text || '',
    };

    if (content.mediaUrls?.length) {
      containerParams.image_url = content.mediaUrls[0];
    } else if (content.link) {
      // Instagram doesn't support link-only posts; include in caption
      containerParams.caption = `${content.text || ''}\n\n${content.link}`;
    }

    const container = await this.apiRequest<any>(`${GRAPH_API}/${igAccountId}/media`, {
      method: 'POST',
      accessToken: tokens.accessToken,
      body: JSON.stringify(containerParams),
    });

    if (!container.id) {
      return { success: false, error: 'Failed to create media container' };
    }

    // Step 2: Publish the container
    const published = await this.apiRequest<any>(`${GRAPH_API}/${igAccountId}/media_publish`, {
      method: 'POST',
      accessToken: tokens.accessToken,
      body: JSON.stringify({ creation_id: container.id }),
    });

    logger.info({ mediaId: published.id }, 'Instagram post published');

    return {
      success: true,
      platformPostId: published.id,
      publishedUrl: `https://www.instagram.com/p/${published.id}`,
    };
  }

  async fetchMetrics(tokens: PlatformTokens, platformPostId: string): Promise<PostMetrics> {
    const data = await this.apiRequest<any>(
      `${GRAPH_API}/${platformPostId}/insights?metric=impressions,reach,likes,comments,shares,saved`,
      { accessToken: tokens.accessToken }
    );

    const metrics: PostMetrics = { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };

    for (const insight of data.data || []) {
      const value = insight.values?.[0]?.value || 0;
      switch (insight.name) {
        case 'impressions': metrics.impressions = value; break;
        case 'likes': metrics.likes = value; break;
        case 'comments': metrics.comments = value; break;
        case 'shares': metrics.shares = value; break;
        case 'saved': metrics.saves = value; break;
      }
    }

    return metrics;
  }

  async refreshAccessToken(tokens: PlatformTokens): Promise<PlatformTokens> {
    // Meta long-lived tokens can be refreshed
    const res = await fetch(
      `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.INSTAGRAM_CLIENT_ID}&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET}&fb_exchange_token=${tokens.accessToken}`
    );

    if (!res.ok) {
      throw new PlatformApiError('instagram', res.status, await res.text());
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    };
  }

  async getProfile(tokens: PlatformTokens): Promise<PlatformProfile> {
    const igAccountId = await this.getIgBusinessAccountId(tokens);
    const data = await this.apiRequest<any>(
      `${GRAPH_API}/${igAccountId}?fields=id,username,name,profile_picture_url,followers_count,media_count`,
      { accessToken: tokens.accessToken }
    );

    return {
      platformUserId: data.id,
      username: data.username,
      displayName: data.name,
      profileUrl: `https://www.instagram.com/${data.username}`,
      avatarUrl: data.profile_picture_url,
      metadata: {
        followers: data.followers_count,
        mediaCount: data.media_count,
      },
    };
  }
}
