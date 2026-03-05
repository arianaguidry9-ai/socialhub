import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const globalForAnthropic = globalThis as unknown as { anthropic: Anthropic };

function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  return new Anthropic({ apiKey });
}

function getClient(): Anthropic {
  if (!globalForAnthropic.anthropic) {
    globalForAnthropic.anthropic = createClient();
  }
  return globalForAnthropic.anthropic;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});

export const AI_MODEL = 'claude-sonnet-4-20250514';

/**
 * Track AI token usage for rate limiting and billing.
 */
export async function trackAiUsage(
  userId: string,
  feature: string,
  tokensIn: number,
  tokensOut: number
) {
  // Dynamically import to avoid circular deps
  const { prisma } = await import('@/lib/db');
  await prisma.aiUsage.create({
    data: {
      userId,
      feature: feature as any,
      tokensIn,
      tokensOut,
      model: AI_MODEL,
    },
  });
  logger.info({ userId, feature, tokensIn, tokensOut }, 'AI usage tracked');
}

/**
 * Check if user has exceeded their free tier AI usage for this month.
 */
export async function checkAiRateLimit(userId: string, feature: string, monthlyLimit: number): Promise<boolean> {
  const { prisma } = await import('@/lib/db');
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await prisma.aiUsage.count({
    where: {
      userId,
      feature: feature as any,
      createdAt: { gte: startOfMonth },
    },
  });

  return count < monthlyLimit;
}
