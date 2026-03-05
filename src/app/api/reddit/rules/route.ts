import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/** GET /api/reddit/rules?subreddit=name — Fetch rules for a subreddit. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subreddit = req.nextUrl.searchParams.get('subreddit') || '';
    if (!subreddit) {
      return NextResponse.json({ rules: [] });
    }

    // Debug mode: return mock rules
    if (process.env.DEBUG_AUTH === 'true') {
      const mockRules = [
        { title: 'Be respectful', description: 'No personal attacks, harassment, or hate speech.' },
        { title: 'No spam or self-promotion', description: 'Accounts must follow the 9:1 ratio for self-promotion.' },
        { title: 'Use descriptive titles', description: 'Titles should clearly describe the content of your post.' },
        { title: 'Follow Reddiquette', description: 'Please follow the general rules of Reddit.' },
        { title: 'No low-effort posts', description: 'Posts should contribute meaningfully to the community.' },
      ];
      return NextResponse.json({ subreddit, rules: mockRules });
    }

    // Fetch from Reddit public API
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/about/rules.json`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SocialHub/1.0' },
    });

    if (!response.ok) {
      return NextResponse.json({ subreddit, rules: [] });
    }

    const json = await response.json();
    const rules = (json.rules || []).map((rule: any) => ({
      title: rule.short_name || rule.violation_reason || 'Rule',
      description: (rule.description || '').substring(0, 300),
    }));

    return NextResponse.json({ subreddit, rules });
  } catch {
    return NextResponse.json({ rules: [] });
  }
}
