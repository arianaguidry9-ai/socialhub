import { BasePlatformConnector, PlatformApiError } from './base';
import type { PublishResult, PlatformProfile } from './base';
import type { PostContent, PostMetrics, PlatformTokens } from '@/types';
import { logger } from '@/lib/logger';

const LINKEDIN_API = 'https://api.linkedin.com/v2';

/**
 * LinkedIn platform connector.
 * Handles posting to personal profiles and company pages via LinkedIn API v2.
 */
export class LinkedInConnector extends BasePlatformConnector {
  readonly platform = 'linkedin';

  async publish(tokens: PlatformTokens, content: PostContent): Promise<PublishResult> {
    // First get the user's URN
    const profile = await this.getProfile(tokens);
    const authorUrn = `urn:li:person:${profile.platformUserId}`;

    const postBody: Record<string, any> = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content.text || '' },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    // Handle link shares
    if (content.link) {
      postBody.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
      postBody.specificContent['com.linkedin.ugc.ShareContent'].media = [
        {
          status: 'READY',
          originalUrl: content.link,
          title: { text: content.title || '' },
        },
      ];
    }

    const data = await this.apiRequest<any>(`${LINKEDIN_API}/ugcPosts`, {
      method: 'POST',
      accessToken: tokens.accessToken,
      body: JSON.stringify(postBody),
      headers: { 'X-Restli-Protocol-Version': '2.0.0' },
    });

    const postId = data.id;
    logger.info({ postId }, 'LinkedIn post published');

    return {
      success: true,
      platformPostId: postId,
      publishedUrl: `https://www.linkedin.com/feed/update/${postId}`,
    };
  }

  async fetchMetrics(tokens: PlatformTokens, platformPostId: string): Promise<PostMetrics> {
    const encodedId = encodeURIComponent(platformPostId);
    const data = await this.apiRequest<any>(
      `${LINKEDIN_API}/socialActions/${encodedId}`,
      {
        accessToken: tokens.accessToken,
        headers: { 'X-Restli-Protocol-Version': '2.0.0' },
      }
    );

    return {
      impressions: 0, // Requires organization analytics API
      likes: data.likesSummary?.totalLikes || 0,
      comments: data.commentsSummary?.totalFirstLevelComments || 0,
      shares: data.shareStatistics?.shareCount || 0,
      saves: 0,
      clicks: 0,
    };
  }

  async refreshAccessToken(tokens: PlatformTokens): Promise<PlatformTokens> {
    if (!tokens.refreshToken) {
      throw new PlatformApiError('linkedin', 400, 'No refresh token available');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    });

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      throw new PlatformApiError('linkedin', res.status, await res.text());
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getProfile(tokens: PlatformTokens): Promise<PlatformProfile> {
    const data = await this.apiRequest<any>(`${LINKEDIN_API}/userinfo`, {
      accessToken: tokens.accessToken,
    });

    return {
      platformUserId: data.sub,
      username: data.email || data.sub,
      displayName: data.name,
      profileUrl: `https://www.linkedin.com/in/${data.sub}`,
      avatarUrl: data.picture,
    };
  }
}
