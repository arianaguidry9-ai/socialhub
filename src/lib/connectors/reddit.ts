import { BasePlatformConnector, PlatformApiError } from './base';
import type { PublishResult, PlatformProfile } from './base';
import type { PostContent, PostMetrics, PlatformTokens } from '@/types';
import { logger } from '@/lib/logger';

const REDDIT_API = 'https://oauth.reddit.com';
const USER_AGENT = 'SocialHub/1.0';

/**
 * Reddit platform connector.
 * Handles posting, metrics fetching, and token refresh via Reddit's OAuth2 API.
 */
export class RedditConnector extends BasePlatformConnector {
  readonly platform = 'reddit';

  async publish(tokens: PlatformTokens, content: PostContent): Promise<PublishResult> {
    if (!content.subreddit) {
      return { success: false, error: 'Subreddit is required for Reddit posts' };
    }

    const formData = new URLSearchParams();
    formData.append('sr', content.subreddit);
    formData.append('title', content.title || content.text?.substring(0, 300) || '');
    formData.append('resubmit', 'true');
    formData.append('send_replies', 'true');

    if (content.flair) {
      formData.append('flair_text', content.flair);
    }

    // Determine post kind
    if (content.link) {
      formData.append('kind', 'link');
      formData.append('url', content.link);
    } else if (content.mediaUrls?.length) {
      formData.append('kind', 'link');
      formData.append('url', content.mediaUrls[0]);
    } else {
      formData.append('kind', 'self');
      formData.append('text', content.text || '');
    }

    const res = await fetch(`${REDDIT_API}/api/submit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || data.json?.errors?.length) {
      const errors = data.json?.errors?.map((e: string[]) => e.join(': ')).join('; ') || 'Unknown error';
      logger.warn({ subreddit: content.subreddit, errors }, 'Reddit post failed');
      return { success: false, error: errors };
    }

    const postUrl = data.json?.data?.url;
    const postId = data.json?.data?.name; // e.g., t3_xxxxx

    logger.info({ postId, subreddit: content.subreddit }, 'Reddit post published');

    return {
      success: true,
      platformPostId: postId,
      publishedUrl: postUrl,
    };
  }

  async fetchMetrics(tokens: PlatformTokens, platformPostId: string): Promise<PostMetrics> {
    // Reddit uses fullname IDs like t3_xxxxx
    const id = platformPostId.startsWith('t3_') ? platformPostId : `t3_${platformPostId}`;

    const data = await this.apiRequest<any>(`${REDDIT_API}/api/info?id=${id}`, {
      accessToken: tokens.accessToken,
      headers: { 'User-Agent': USER_AGENT },
    });

    const post = data?.data?.children?.[0]?.data;
    if (!post) {
      return { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };
    }

    return {
      impressions: post.view_count || 0,
      likes: post.ups || 0,
      comments: post.num_comments || 0,
      shares: post.num_crossposts || 0,
      saves: 0, // Not available in Reddit API
      clicks: post.clicked ? 1 : 0,
    };
  }

  async refreshAccessToken(tokens: PlatformTokens): Promise<PlatformTokens> {
    if (!tokens.refreshToken) {
      throw new PlatformApiError('reddit', 400, 'No refresh token available');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    });

    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
        ).toString('base64')}`,
        'User-Agent': USER_AGENT,
      },
      body,
    });

    if (!res.ok) {
      throw new PlatformApiError('reddit', res.status, await res.text());
    }

    const data = await res.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getProfile(tokens: PlatformTokens): Promise<PlatformProfile> {
    const data = await this.apiRequest<any>(`${REDDIT_API}/api/v1/me`, {
      accessToken: tokens.accessToken,
      headers: { 'User-Agent': USER_AGENT },
    });

    return {
      platformUserId: data.id,
      username: data.name,
      displayName: data.subreddit?.display_name_prefixed,
      profileUrl: `https://reddit.com/user/${data.name}`,
      avatarUrl: data.icon_img?.split('?')[0],
      metadata: {
        linkKarma: data.link_karma,
        commentKarma: data.comment_karma,
        totalKarma: data.total_karma,
        accountAge: data.created_utc,
        isGold: data.is_gold,
      },
    };
  }

  /** Fetch subreddit rules for compliance checking. */
  async getSubredditRules(tokens: PlatformTokens, subreddit: string) {
    const [rulesData, aboutData] = await Promise.all([
      this.apiRequest<any>(`${REDDIT_API}/r/${subreddit}/about/rules.json`, {
        accessToken: tokens.accessToken,
        headers: { 'User-Agent': USER_AGENT },
      }),
      this.apiRequest<any>(`${REDDIT_API}/r/${subreddit}/about.json`, {
        accessToken: tokens.accessToken,
        headers: { 'User-Agent': USER_AGENT },
      }),
    ]);

    return {
      rules: rulesData.rules || [],
      sidebar: aboutData.data?.description || '',
      flairs: aboutData.data?.link_flair_enabled,
      subscriberCount: aboutData.data?.subscribers,
      minAccountAge: aboutData.data?.comment_score_hide_mins,
      postRequirements: aboutData.data?.submission_type,
    };
  }

  async deletePost(tokens: PlatformTokens, platformPostId: string): Promise<boolean> {
    const res = await fetch(`${REDDIT_API}/api/del`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ id: platformPostId }),
    });
    return res.ok;
  }
}
