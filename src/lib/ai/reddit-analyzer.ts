import { anthropic, AI_MODEL, trackAiUsage } from './client';
import { subredditRulesCacheRef, socialAccountsRef, docData } from '@/lib/db';
import { RedditConnector } from '@/lib/connectors/reddit';
import { decrypt } from '@/lib/encryption';
import { logger } from '@/lib/logger';
import type { SubredditRuleAnalysis, PlatformTokens } from '@/types';
import type Anthropic from '@anthropic-ai/sdk';

const redditConnector = new RedditConnector();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface AnalyzeInput {
  userId: string;
  socialAccountId: string;
  subreddit: string;
  title: string;
  content?: string;
  postType: 'text' | 'link' | 'image' | 'video';
}

/**
 * Full Reddit subreddit rule analysis pipeline:
 * 1. Fetch subreddit rules (cached 24h)
 * 2. Pass rules + proposed post to Claude
 * 3. Return compliance analysis
 */
export async function analyzeSubredditCompliance(input: AnalyzeInput): Promise<SubredditRuleAnalysis> {
  const { userId, socialAccountId, subreddit, title, content, postType } = input;

  // 1. Check cache first
  const cacheDoc = await subredditRulesCacheRef.doc(subreddit.toLowerCase()).get();
  const cached = cacheDoc.exists ? cacheDoc.data() : null;

  let rules: any;
  let sidebar: string | null = null;

  if (cached && (cached.expiresAt?.toDate?.() ?? cached.expiresAt) > new Date()) {
    rules = cached.rulesJson;
    sidebar = cached.sidebarMd;
    logger.info({ subreddit }, 'Using cached subreddit rules');
  } else {
    // 2. Fetch fresh rules from Reddit API
    const accountSnap = await socialAccountsRef.doc(socialAccountId).get();
    const account = accountSnap.data();

    if (!account) {
      throw new Error('Social account not found');
    }

    const tokens: PlatformTokens = {
      accessToken: decrypt(account.accessToken),
      refreshToken: account.refreshToken ? decrypt(account.refreshToken) : undefined,
    };

    const rulesData = await redditConnector.getSubredditRules(tokens, subreddit);
    rules = rulesData;
    sidebar = rulesData.sidebar;

    // Cache the rules
    await subredditRulesCacheRef.doc(subreddit.toLowerCase()).set({
      subreddit: subreddit.toLowerCase(),
      rulesJson: rulesData,
      sidebarMd: sidebar,
      wikiJson: null,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    });

    logger.info({ subreddit }, 'Fetched and cached fresh subreddit rules');
  }

  // 3. Check account requirements (karma, age)
  const accountSnap2 = await socialAccountsRef.doc(socialAccountId).get();
  const accountData = accountSnap2.data();

  const accountMeta = accountData?.metadata as Record<string, any> | null;
  const totalKarma = accountMeta?.totalKarma ?? 0;
  const accountAge = accountMeta?.accountAge
    ? Math.floor((Date.now() / 1000 - accountMeta.accountAge) / 86400)
    : 0;

  // 4. Analyze with Claude
  const systemPrompt = `You are a Reddit compliance analyst. Given subreddit rules and a proposed post, analyze whether the post complies with all rules.

You must return ONLY valid JSON in this exact format:
{
  "allowed": boolean,
  "violations": string[],
  "suggestions": string[],
  "recommended_flair": string | null,
  "best_time_to_post": string
}

Consider:
- All explicit rules from the subreddit
- Common Reddit etiquette (no excessive self-promotion, etc.)
- The post type (text/link/image/video) and whether the subreddit allows it
- Flair requirements
- Title formatting requirements
- Account karma (${totalKarma}) and age (${accountAge} days) restrictions if mentioned in rules
- Best time to post based on the subreddit's typical activity patterns`;

  const userPrompt = `Given these subreddit rules for r/${subreddit}:

${JSON.stringify(rules, null, 2)}

${sidebar ? `Sidebar/description:\n${sidebar.substring(0, 2000)}\n` : ''}

And this proposed post:
- Title: "${title}"
- Content: "${content || '(no body text)'}"
- Type: ${postType}

Return JSON with your compliance analysis.`;

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Track usage
  await trackAiUsage(
    userId,
    'REDDIT_RULES',
    message.usage.input_tokens,
    message.usage.output_tokens
  );

  // Parse response
  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  try {
    // Extract JSON from response (Claude sometimes wraps in markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    const analysis: SubredditRuleAnalysis = JSON.parse(jsonMatch[0]);
    return analysis;
  } catch (err) {
    logger.error({ err, responseText }, 'Failed to parse Reddit rule analysis');
    return {
      allowed: false,
      violations: ['Unable to analyze rules - please review manually'],
      suggestions: ['Check the subreddit rules page directly'],
      recommended_flair: null,
      best_time_to_post: 'Check subreddit analytics',
    };
  }
}
