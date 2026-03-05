import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.object({
    text: z.string().max(40000).optional(),
    title: z.string().max(300).optional(),
    mediaUrls: z.array(z.string().url()).max(10).optional(),
    link: z.string().url().optional(),
    subreddit: z.string().max(100).optional(),
    flair: z.string().max(100).optional(),
  }),
  targets: z.array(
    z.object({
      socialAccountId: z.string().cuid(),
      platform: z.string(),
      subreddit: z.string().max(100).optional(),
      flair: z.string().max(100).optional(),
    })
  ).min(1),
  scheduledAt: z.string().datetime().optional(),
});

export const connectAccountSchema = z.object({
  platform: z.enum(['reddit', 'twitter', 'instagram', 'linkedin']),
});

export const aiCaptionSchema = z.object({
  topic: z.string().min(1).max(1000),
  platform: z.enum(['reddit', 'twitter', 'instagram', 'linkedin']),
  tone: z.enum(['casual', 'professional', 'humorous', 'informative']).optional(),
});

export const redditAnalyzeSchema = z.object({
  subreddit: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  content: z.string().max(40000).optional(),
  postType: z.enum(['text', 'link', 'image', 'video']).default('text'),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;
export type AiCaptionInput = z.infer<typeof aiCaptionSchema>;
export type RedditAnalyzeInput = z.infer<typeof redditAnalyzeSchema>;
