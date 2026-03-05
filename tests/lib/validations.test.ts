import { createPostSchema, aiCaptionSchema, redditAnalyzeSchema } from '@/lib/validations';

describe('createPostSchema', () => {
  it('should accept valid post data', () => {
    const result = createPostSchema.safeParse({
      content: { text: 'Hello world' },
      targets: [{ socialAccountId: 'clxxxxxxxxxxxxxxxxx', platform: 'twitter' }],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty targets', () => {
    const result = createPostSchema.safeParse({
      content: { text: 'Hello' },
      targets: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid URLs in mediaUrls', () => {
    const result = createPostSchema.safeParse({
      content: { text: 'test', mediaUrls: ['not-a-url'] },
      targets: [{ socialAccountId: 'clxxxxxxxxxxxxxxxxx', platform: 'reddit' }],
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid scheduled date', () => {
    const result = createPostSchema.safeParse({
      content: { text: 'Scheduled post' },
      targets: [{ socialAccountId: 'clxxxxxxxxxxxxxxxxx', platform: 'twitter' }],
      scheduledAt: '2025-12-01T10:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('aiCaptionSchema', () => {
  it('should accept valid caption request', () => {
    const result = aiCaptionSchema.safeParse({
      topic: 'AI in healthcare',
      platform: 'linkedin',
      tone: 'professional',
    });
    expect(result.success).toBe(true);
  });

  it('should reject unsupported platform', () => {
    const result = aiCaptionSchema.safeParse({
      topic: 'test',
      platform: 'tiktok',
    });
    expect(result.success).toBe(false);
  });
});

describe('redditAnalyzeSchema', () => {
  it('should accept valid reddit analysis input', () => {
    const result = redditAnalyzeSchema.safeParse({
      subreddit: 'programming',
      title: 'My cool project',
      content: 'Details about the project',
      postType: 'text',
    });
    expect(result.success).toBe(true);
  });

  it('should default postType to text', () => {
    const result = redditAnalyzeSchema.safeParse({
      subreddit: 'webdev',
      title: 'Check this out',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.postType).toBe('text');
    }
  });
});
