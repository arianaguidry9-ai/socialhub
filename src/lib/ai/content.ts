import { anthropic, AI_MODEL, trackAiUsage, checkAiRateLimit } from './client';
import { logger } from '@/lib/logger';
import type { Platform } from '@/types';
import type Anthropic from '@anthropic-ai/sdk';

const PLATFORM_TONE: Record<string, string> = {
  reddit: 'Casual, community-focused, authentic. Avoid sounding corporate or promotional. Use Reddit conventions.',
  twitter: 'Concise, punchy, engaging. Use hooks. Max 280 chars. Hashtags sparingly.',
  instagram: 'Visual-first, lifestyle-oriented. Use relevant hashtags (5-15). Include call-to-action.',
  linkedin: 'Professional, informative, thought-leadership. Longer form okay. Industry-relevant.',
};

/**
 * Generate a platform-appropriate caption using Claude.
 */
export async function generateCaption(
  userId: string,
  topic: string,
  platform: Platform,
  tone?: string
): Promise<{ caption: string; hashtags: string[] }> {
  const allowed = await checkAiRateLimit(userId, 'CAPTION', Infinity); // Checked at API layer
  if (!allowed) {
    throw new Error('AI caption generation limit reached for this month');
  }

  const systemPrompt = `You are a social media content expert. Generate engaging captions optimized for ${platform}.

Tone: ${tone || PLATFORM_TONE[platform] || 'Professional and engaging'}

Return JSON: { "caption": "string", "hashtags": ["string"] }
Only return valid JSON, nothing else.`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Write a ${platform} caption about: ${topic}` }],
  });

  await trackAiUsage(userId, 'CAPTION', message.usage.input_tokens, message.usage.output_tokens);

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch![0]);
  } catch {
    return { caption: text, hashtags: [] };
  }
}

/**
 * Suggest hashtags based on content and platform.
 */
export async function suggestHashtags(
  userId: string,
  content: string,
  platform: Platform
): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 256,
    system: `Suggest relevant hashtags for this ${platform} post. Return JSON: { "hashtags": ["string"] }. Only return valid JSON.`,
    messages: [{ role: 'user', content }],
  });

  await trackAiUsage(userId, 'HASHTAG', message.usage.input_tokens, message.usage.output_tokens);

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch![0]).hashtags;
  } catch {
    return [];
  }
}

/**
 * Repurpose a post for multiple platforms.
 */
export async function repurposeContent(
  userId: string,
  originalContent: string,
  originalPlatform: Platform,
  targetPlatforms: Platform[]
): Promise<Record<Platform, string>> {
  const systemPrompt = `You are a social media expert. Adapt the given post from ${originalPlatform} to each target platform, adjusting tone, length, and format.

Platform guidelines:
${Object.entries(PLATFORM_TONE).map(([p, t]) => `- ${p}: ${t}`).join('\n')}

Return JSON: { "platform_name": "adapted content", ... }
Only return valid JSON.`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Original ${originalPlatform} post:\n${originalContent}\n\nAdapt for: ${targetPlatforms.join(', ')}`,
      },
    ],
  });

  await trackAiUsage(userId, 'REPURPOSE', message.usage.input_tokens, message.usage.output_tokens);

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch![0]);
  } catch {
    logger.error('Failed to parse repurposed content');
    return {} as Record<Platform, string>;
  }
}

/**
 * Generate performance insight summaries from analytics data.
 */
export async function generateInsights(
  userId: string,
  analyticsData: Record<string, any>
): Promise<string> {
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system: `You are a social media analytics expert. Analyze the provided engagement data and provide actionable insights. Be specific and data-driven. Write in a friendly, helpful tone.`,
    messages: [
      {
        role: 'user',
        content: `Here's my social media performance data:\n${JSON.stringify(analyticsData, null, 2)}\n\nGive me key insights and recommendations.`,
      },
    ],
  });

  await trackAiUsage(userId, 'INSIGHT', message.usage.input_tokens, message.usage.output_tokens);

  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
