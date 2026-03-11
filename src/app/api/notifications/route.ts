import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { socialAccountsRef, postTargetsRef, postMetricsRef, postsRef } from '@/lib/db';
import { logger } from '@/lib/logger';

/** GET /api/notifications — Fetch notifications from connected platforms. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform'); // filter by platform
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // Debug mode: return mock notifications
    if (process.env.DEBUG_AUTH === 'true') {
      const mockNotifications = generateMockNotifications(platform);
      const paginated = mockNotifications.slice((page - 1) * limit, page * limit);
      return NextResponse.json({
        notifications: paginated,
        total: mockNotifications.length,
        page,
        limit,
      });
    }

    // Build query for connected accounts
    let accountQuery: FirebaseFirestore.Query = socialAccountsRef.where('userId', '==', session.user.id);
    if (platform) {
      accountQuery = accountQuery.where('platform', '==', platform.toUpperCase());
    }
    const accountsSnap = await accountQuery.get();
    const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Synthesize notifications from metrics and post activity
    const notifications: any[] = [];
    for (const account of accounts) {
      // Get recent published targets for this account
      const targetsSnap = await postTargetsRef
        .where('socialAccountId', '==', account.id)
        .where('status', '==', 'PUBLISHED')
        .orderBy('updatedAt', 'desc')
        .limit(20)
        .get();

      for (const tDoc of targetsSnap.docs) {
        const target = { id: tDoc.id, ...tDoc.data() } as any;

        // Get latest metric
        const mSnap = await postMetricsRef
          .where('postTargetId', '==', target.id)
          .orderBy('fetchedAt', 'desc')
          .limit(1)
          .get();
        const metric = mSnap.empty ? null : mSnap.docs[0].data();

        // Get post data
        const postSnap = await postsRef.doc(target.postId).get();
        const post = postSnap.data() || {} as any;

        if (metric) {
          if (metric.likes > 0) {
            notifications.push({
              id: `${target.id}-likes`,
              type: 'like',
              platform: (account as any).platform?.toLowerCase(),
              username: (account as any).username,
              postTitle: post.title || post.content?.substring(0, 60) || 'Your post',
              postId: target.postId,
              publishedUrl: target.publishedUrl,
              count: metric.likes,
              message: `${metric.likes} new like${metric.likes > 1 ? 's' : ''} on "${post.title || post.content?.substring(0, 40) || 'your post'}"`,
              createdAt: metric.fetchedAt,
            });
          }
          if (metric.comments > 0) {
            notifications.push({
              id: `${target.id}-comments`,
              type: 'comment',
              platform: (account as any).platform?.toLowerCase(),
              username: (account as any).username,
              postTitle: post.title || post.content?.substring(0, 60) || 'Your post',
              postId: target.postId,
              publishedUrl: target.publishedUrl,
              count: metric.comments,
              message: `${metric.comments} new comment${metric.comments > 1 ? 's' : ''} on "${post.title || post.content?.substring(0, 40) || 'your post'}"`,
              createdAt: metric.fetchedAt,
            });
          }
          if (metric.shares > 0) {
            notifications.push({
              id: `${target.id}-shares`,
              type: 'share',
              platform: (account as any).platform?.toLowerCase(),
              username: (account as any).username,
              postTitle: post.title || post.content?.substring(0, 60) || 'Your post',
              postId: target.postId,
              publishedUrl: target.publishedUrl,
              count: metric.shares,
              message: `${metric.shares} share${metric.shares > 1 ? 's' : ''} on "${post.title || post.content?.substring(0, 40) || 'your post'}"`,
              createdAt: metric.fetchedAt,
            });
          }
        }
      }
    }

    // Sort by date desc
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginated = notifications.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      notifications: paginated,
      total: notifications.length,
      page,
      limit,
    });
  } catch (err) {
    logger.error({ err }, 'Fetch notifications failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateMockNotifications(platform: string | null) {
  const now = Date.now();
  const all = [
    // Reddit notifications
    { id: 'r1', type: 'comment', platform: 'reddit', username: 'u/debuguser', postTitle: 'Launching our new AI feature', postId: '1', publishedUrl: 'https://reddit.com/r/technology/comments/abc123', count: 12, message: '12 new comments on "Launching our new AI feature"', createdAt: new Date(now - 1800_000).toISOString(), details: [{ author: 'u/techfan99', text: 'This is incredible! How does the AI analysis work?', createdAt: new Date(now - 1800_000).toISOString() }, { author: 'u/devguru', text: 'Just tried it, the accuracy is impressive.', createdAt: new Date(now - 3600_000).toISOString() }] },
    { id: 'r2', type: 'like', platform: 'reddit', username: 'u/debuguser', postTitle: 'Weekly dev update #12', postId: '2', publishedUrl: 'https://reddit.com/r/webdev/comments/def456', count: 247, message: '247 upvotes on "Weekly dev update #12"', createdAt: new Date(now - 3600_000).toISOString() },
    { id: 'r3', type: 'share', platform: 'reddit', username: 'u/debuguser', postTitle: 'Launching our new AI feature', postId: '1', publishedUrl: 'https://reddit.com/r/technology/comments/abc123', count: 34, message: '34 crossposts on "Launching our new AI feature"', createdAt: new Date(now - 7200_000).toISOString() },
    // Twitter notifications
    { id: 't1', type: 'like', platform: 'twitter', username: '@debuguser', postTitle: 'Excited to announce our new AI-powered...', postId: '1', publishedUrl: 'https://x.com/debuguser/status/123456', count: 89, message: '89 likes on "Excited to announce our new AI-powered..."', createdAt: new Date(now - 900_000).toISOString() },
    { id: 't2', type: 'comment', platform: 'twitter', username: '@debuguser', postTitle: 'Excited to announce our new AI-powered...', postId: '1', publishedUrl: 'https://x.com/debuguser/status/123456', count: 23, message: '23 replies on "Excited to announce our new AI-powered..."', createdAt: new Date(now - 2700_000).toISOString(), details: [{ author: '@sarah_dev', text: 'Congrats! When is the public beta?', createdAt: new Date(now - 2700_000).toISOString() }, { author: '@marktech', text: 'This looks amazing, retweeting!', createdAt: new Date(now - 5400_000).toISOString() }] },
    { id: 't3', type: 'share', platform: 'twitter', username: '@debuguser', postTitle: 'Excited to announce our new AI-powered...', postId: '1', publishedUrl: 'https://x.com/debuguser/status/123456', count: 45, message: '45 retweets on "Excited to announce our new AI-powered..."', createdAt: new Date(now - 5400_000).toISOString() },
    { id: 't4', type: 'mention', platform: 'twitter', username: '@debuguser', postTitle: null, postId: null, publishedUrl: 'https://x.com/influencer_joe/status/789012', count: 1, message: '@influencer_joe mentioned you: "Check out @debuguser\'s new tool!"', createdAt: new Date(now - 10800_000).toISOString(), details: [{ author: '@influencer_joe', text: 'Check out @debuguser\'s new tool! Game changer for social media management.', createdAt: new Date(now - 10800_000).toISOString() }] },
    // Instagram notifications
    { id: 'i1', type: 'like', platform: 'instagram', username: '@debuguser', postTitle: 'Product launch reel', postId: '3', publishedUrl: 'https://instagram.com/p/xyz789', count: 312, message: '312 likes on "Product launch reel"', createdAt: new Date(now - 600_000).toISOString() },
    { id: 'i2', type: 'comment', platform: 'instagram', username: '@debuguser', postTitle: 'Product launch reel', postId: '3', publishedUrl: 'https://instagram.com/p/xyz789', count: 18, message: '18 comments on "Product launch reel"', createdAt: new Date(now - 4500_000).toISOString(), details: [{ author: '@design_lover', text: 'The UI looks so clean! 🔥', createdAt: new Date(now - 4500_000).toISOString() }, { author: '@startup_hub', text: 'Great product, following!', createdAt: new Date(now - 7200_000).toISOString() }] },
    { id: 'i3', type: 'follower', platform: 'instagram', username: '@debuguser', postTitle: null, postId: null, publishedUrl: null, count: 24, message: '24 new followers this week', createdAt: new Date(now - 14400_000).toISOString() },
    // LinkedIn notifications
    { id: 'l1', type: 'like', platform: 'linkedin', username: 'Debug User', postTitle: 'Best practices for social media marketing', postId: '5', publishedUrl: 'https://linkedin.com/feed/update/urn:li:activity:123', count: 156, message: '156 reactions on "Best practices for social media marketing"', createdAt: new Date(now - 1200_000).toISOString() },
    { id: 'l2', type: 'comment', platform: 'linkedin', username: 'Debug User', postTitle: 'Best practices for social media marketing', postId: '5', publishedUrl: 'https://linkedin.com/feed/update/urn:li:activity:123', count: 8, message: '8 comments on "Best practices for social media marketing"', createdAt: new Date(now - 9000_000).toISOString(), details: [{ author: 'Jane Smith, Marketing Director', text: 'Excellent insights! I especially agree with point #3 about consistency.', createdAt: new Date(now - 9000_000).toISOString() }] },
    { id: 'l3', type: 'share', platform: 'linkedin', username: 'Debug User', postTitle: 'Best practices for social media marketing', postId: '5', publishedUrl: 'https://linkedin.com/feed/update/urn:li:activity:123', count: 12, message: '12 reposts on "Best practices for social media marketing"', createdAt: new Date(now - 18000_000).toISOString() },
    // TikTok notifications
    { id: 'tk1', type: 'like', platform: 'tiktok', username: '@debuguser', postTitle: 'Day in the life of a dev', postId: '6', publishedUrl: 'https://tiktok.com/@debuguser/video/123', count: 2_340, message: '2,340 likes on "Day in the life of a dev"', createdAt: new Date(now - 300_000).toISOString() },
    { id: 'tk2', type: 'comment', platform: 'tiktok', username: '@debuguser', postTitle: 'Day in the life of a dev', postId: '6', publishedUrl: 'https://tiktok.com/@debuguser/video/123', count: 87, message: '87 comments on "Day in the life of a dev"', createdAt: new Date(now - 3000_000).toISOString(), details: [{ author: '@code_bro', text: 'What IDE theme is that? Looks sick!', createdAt: new Date(now - 3000_000).toISOString() }, { author: '@devlife101', text: 'Living the dream 🚀', createdAt: new Date(now - 6000_000).toISOString() }] },
    { id: 'tk3', type: 'share', platform: 'tiktok', username: '@debuguser', postTitle: 'Day in the life of a dev', postId: '6', publishedUrl: 'https://tiktok.com/@debuguser/video/123', count: 156, message: '156 shares on "Day in the life of a dev"', createdAt: new Date(now - 12000_000).toISOString() },
    { id: 'tk4', type: 'follower', platform: 'tiktok', username: '@debuguser', postTitle: null, postId: null, publishedUrl: null, count: 89, message: '89 new followers this week', createdAt: new Date(now - 21600_000).toISOString() },
  ];

  if (platform) {
    return all.filter((n) => n.platform === platform.toLowerCase());
  }
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
