import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/** GET /api/reddit/subreddits?q=search_term — Search for subreddits using Reddit's public JSON API. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get('q') || '';
    if (!query || query.length < 2) {
      return NextResponse.json({ subreddits: [] });
    }

    // Debug mode: return mock subreddits
    if (process.env.DEBUG_AUTH === 'true') {
      const mockSubs = [
        { name: 'programming', subscribers: 6_200_000, description: 'Computer programming', icon: '' },
        { name: 'webdev', subscribers: 1_800_000, description: 'A community for web developers', icon: '' },
        { name: 'javascript', subscribers: 2_400_000, description: 'All about JavaScript', icon: '' },
        { name: 'reactjs', subscribers: 800_000, description: 'React community', icon: '' },
        { name: 'nextjs', subscribers: 200_000, description: 'The React Framework', icon: '' },
        { name: 'typescript', subscribers: 450_000, description: 'TypeScript Language', icon: '' },
        { name: 'learnprogramming', subscribers: 4_100_000, description: 'Learn to code', icon: '' },
        { name: 'ArtificialIntelligence', subscribers: 900_000, description: 'AI discussion', icon: '' },
        { name: 'MachineLearning', subscribers: 2_800_000, description: 'ML research and discussion', icon: '' },
        { name: 'startups', subscribers: 1_200_000, description: 'Startup community', icon: '' },
        { name: 'SideProject', subscribers: 300_000, description: 'Share your side projects', icon: '' },
        { name: 'technology', subscribers: 14_600_000, description: 'Technology news', icon: '' },
      ];
      const q = query.toLowerCase();
      const filtered = mockSubs.filter((s) => s.name.toLowerCase().includes(q));
      return NextResponse.json({ subreddits: filtered });
    }

    // Use Reddit's public search JSON endpoint (no auth required)
    const url = new URL('https://www.reddit.com/subreddits/search.json');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '15');
    url.searchParams.set('include_over_18', 'false');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'SocialHub/1.0' },
    });

    if (!response.ok) {
      return NextResponse.json({ subreddits: [] });
    }

    const json = await response.json();
    const subreddits = (json.data?.children || []).map((child: any) => ({
      name: child.data.display_name,
      subscribers: child.data.subscribers || 0,
      description: (child.data.public_description || '').substring(0, 150),
      icon: child.data.icon_img || child.data.community_icon || '',
    }));

    return NextResponse.json({ subreddits });
  } catch {
    return NextResponse.json({ subreddits: [] });
  }
}
