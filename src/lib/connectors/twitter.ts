import { BasePlatformConnector, PlatformApiError } from './base';
import type { PublishResult, PlatformProfile } from './base';
import type { PostContent, PostMetrics, PlatformTokens } from '@/types';
import { logger } from '@/lib/logger';

const TWITTER_API = 'https://api.twitter.com/2';

/**
 * Twitter/X platform connector.
 * Uses Twitter API v2 for posting, metrics, and token refresh.
 */
export class TwitterConnector extends BasePlatformConnector {
  readonly platform = 'twitter';

  async publish(tokens: PlatformTokens, content: PostContent): Promise<PublishResult> {
    const tweetBody: Record<string, any> = {};

    // Build tweet text
    let text = content.text || '';
    if (content.link) {
      text = text ? `${text}\n\n${content.link}` : content.link;
    }
    tweetBody.text = text.substring(0, 280);

    // Handle media if present
    if (content.mediaUrls?.length) {
      // Media must be uploaded first via v1.1 media upload endpoint
      // For now, we include the URL in the tweet text
      const mediaUrl = content.mediaUrls[0];
      if (!tweetBody.text.includes(mediaUrl)) {
        tweetBody.text = `${tweetBody.text}\n${mediaUrl}`.substring(0, 280);
      }
    }

    const data = await this.apiRequest<any>(`${TWITTER_API}/tweets`, {
      method: 'POST',
      accessToken: tokens.accessToken,
      body: JSON.stringify(tweetBody),
    });

    const tweetId = data.data?.id;
    logger.info({ tweetId }, 'Tweet published');

    return {
      success: true,
      platformPostId: tweetId,
      publishedUrl: `https://x.com/i/web/status/${tweetId}`,
    };
  }

  async fetchMetrics(tokens: PlatformTokens, platformPostId: string): Promise<PostMetrics> {
    const data = await this.apiRequest<any>(
      `${TWITTER_API}/tweets/${platformPostId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics`,
      { accessToken: tokens.accessToken }
    );

    const pub = data.data?.public_metrics || {};
    const nonPub = data.data?.non_public_metrics || {};

    return {
      impressions: nonPub.impression_count || pub.impression_count || 0,
      likes: pub.like_count || 0,
      comments: pub.reply_count || 0,
      shares: pub.retweet_count + (pub.quote_count || 0),
      saves: pub.bookmark_count || 0,
      clicks: nonPub.url_link_clicks || 0,
    };
  }

  async refreshAccessToken(tokens: PlatformTokens): Promise<PlatformTokens> {
    if (!tokens.refreshToken) {
      throw new PlatformApiError('twitter', 400, 'No refresh token available');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: process.env.TWITTER_CLIENT_ID!,
    });

    const res = await fetch(`${TWITTER_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      throw new PlatformApiError('twitter', res.status, await res.text());
    }

    const data = await res.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getProfile(tokens: PlatformTokens): Promise<PlatformProfile> {
    const data = await this.apiRequest<any>(
      `${TWITTER_API}/users/me?user.fields=profile_image_url,public_metrics,username`,
      { accessToken: tokens.accessToken }
    );

    return {
      platformUserId: data.data.id,
      username: data.data.username,
      displayName: data.data.name,
      profileUrl: `https://x.com/${data.data.username}`,
      avatarUrl: data.data.profile_image_url,
      metadata: {
        followers: data.data.public_metrics?.followers_count,
        following: data.data.public_metrics?.following_count,
        tweetCount: data.data.public_metrics?.tweet_count,
      },
    };
  }

  async deletePost(tokens: PlatformTokens, platformPostId: string): Promise<boolean> {
    try {
      await this.apiRequest(`${TWITTER_API}/tweets/${platformPostId}`, {
        method: 'DELETE',
        accessToken: tokens.accessToken,
      });
      return true;
    } catch {
      return false;
    }
  }
}
