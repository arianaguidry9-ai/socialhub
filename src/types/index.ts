export type Platform = 'reddit' | 'twitter' | 'instagram' | 'linkedin' | 'tiktok' | 'facebook' | 'pinterest' | 'mastodon' | 'bluesky' | 'youtube';

export type PostStatus = 'draft' | 'scheduled' | 'posting' | 'published' | 'failed';

export type UserPlan = 'free' | 'premium';

export interface PostContent {
  text?: string;
  mediaUrls?: string[];
  link?: string;
  title?: string; // Reddit
  subreddit?: string; // Reddit
  flair?: string; // Reddit
}

export interface PostMetrics {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}

export interface SubredditRuleAnalysis {
  allowed: boolean;
  violations: string[];
  suggestions: string[];
  recommended_flair: string | null;
  best_time_to_post: string;
}

export interface PlatformTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/** Free tier limits. */
export const FREE_TIER_LIMITS = {
  maxAccounts: 2,
  maxPostsPerMonth: 10,
  analyticsWindowDays: 7,
  maxAiCaptionsPerMonth: 5,
  redditRuleAnalysis: false,
} as const;

/** Premium tier limits (effectively unlimited). */
export const PREMIUM_TIER_LIMITS = {
  maxAccounts: Infinity,
  maxPostsPerMonth: Infinity,
  analyticsWindowDays: Infinity,
  maxAiCaptionsPerMonth: Infinity,
  redditRuleAnalysis: true,
} as const;
