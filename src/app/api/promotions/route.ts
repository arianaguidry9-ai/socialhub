import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

/** GET /api/promotions — Fetch promotions data (campaigns, creators, requests). */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'campaigns';
    const contentType = searchParams.get('contentType');
    const platform = searchParams.get('platform');

    // Return mock data (real implementation would integrate with AdSense API + creator DB)
    if (tab === 'campaigns') {
      return NextResponse.json({ campaigns: getMockCampaigns() });
    }

    if (tab === 'creators') {
      let creators = getMockCreators();
      if (contentType && contentType !== 'all') {
        creators = creators.filter((c) => c.contentType === contentType);
      }
      if (platform && platform !== 'all') {
        creators = creators.filter((c) => c.platforms.includes(platform));
      }
      return NextResponse.json({ creators });
    }

    if (tab === 'requests') {
      return NextResponse.json({ requests: getMockRequests() });
    }

    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
  } catch (err) {
    logger.error({ err }, 'Fetch promotions failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/promotions — Create a campaign or promotion request. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create-campaign') {
      return NextResponse.json({
        success: true,
        campaign: { id: `camp_${Date.now()}`, ...body.campaign, status: 'DRAFT', createdAt: new Date().toISOString() },
      }, { status: 201 });
    }

    if (action === 'contact-creator') {
      return NextResponse.json({
        success: true,
        message: 'Request sent to creator',
      });
    }

    if (action === 'submit-request') {
      return NextResponse.json({
        success: true,
        request: { id: `req_${Date.now()}`, ...body.request, status: 'PENDING', createdAt: new Date().toISOString() },
      }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    logger.error({ err }, 'Promotions action failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getMockCampaigns() {
  return [
    { id: 'camp_1', name: 'Summer Product Launch', platform: 'instagram', status: 'ACTIVE', budget: 500, spent: 234.50, impressions: 45_200, clicks: 1_230, ctr: 2.72, startDate: '2026-02-15', endDate: '2026-03-15' },
    { id: 'camp_2', name: 'Dev Tool Awareness', platform: 'reddit', status: 'ACTIVE', budget: 300, spent: 87.20, impressions: 12_800, clicks: 456, ctr: 3.56, startDate: '2026-03-01', endDate: '2026-03-31' },
    { id: 'camp_3', name: 'Q1 Brand Campaign', platform: 'twitter', status: 'COMPLETED', budget: 1000, spent: 998.40, impressions: 128_000, clicks: 3_420, ctr: 2.67, startDate: '2026-01-01', endDate: '2026-02-28' },
    { id: 'camp_4', name: 'LinkedIn Thought Leadership', platform: 'linkedin', status: 'PAUSED', budget: 200, spent: 45.00, impressions: 5_600, clicks: 189, ctr: 3.38, startDate: '2026-02-20', endDate: '2026-04-20' },
    { id: 'camp_5', name: 'TikTok Growth Push', platform: 'tiktok', status: 'DRAFT', budget: 750, spent: 0, impressions: 0, clicks: 0, ctr: 0, startDate: '2026-03-10', endDate: '2026-04-10' },
  ];
}

function getMockCreators() {
  return [
    { id: 'cr_1', name: 'TechReviewPro', username: '@techreviewpro', platforms: ['youtube', 'twitter', 'instagram'], contentType: 'tech', followers: 245_000, engagement: 4.2, avgViews: 32_000, rate: '$500-1000/post', avatarInitial: 'T', verified: true, bio: 'In-depth tech reviews and tutorials. 5+ years covering SaaS and dev tools.' },
    { id: 'cr_2', name: 'FitnessWithMaya', username: '@fitnesswithmaya', platforms: ['instagram', 'tiktok', 'youtube'], contentType: 'fitness', followers: 890_000, engagement: 5.8, avgViews: 120_000, rate: '$1000-2500/post', avatarInitial: 'F', verified: true, bio: 'Certified personal trainer. Daily workouts, nutrition tips, and wellness content.' },
    { id: 'cr_3', name: 'CodeWithSam', username: '@codewithsam', platforms: ['youtube', 'twitter', 'tiktok'], contentType: 'tech', followers: 156_000, engagement: 6.1, avgViews: 28_000, rate: '$300-700/post', avatarInitial: 'C', verified: false, bio: 'Full-stack developer sharing coding tutorials, project builds, and career advice.' },
    { id: 'cr_4', name: 'FoodieAdventures', username: '@foodieadventures', platforms: ['instagram', 'tiktok', 'youtube'], contentType: 'food', followers: 1_200_000, engagement: 7.3, avgViews: 250_000, rate: '$2000-5000/post', avatarInitial: 'F', verified: true, bio: 'Food blogger and recipe creator. Restaurant reviews and cooking tutorials.' },
    { id: 'cr_5', name: 'StartupInsider', username: '@startupinsider', platforms: ['twitter', 'linkedin', 'youtube'], contentType: 'business', followers: 320_000, engagement: 3.9, avgViews: 45_000, rate: '$800-1500/post', avatarInitial: 'S', verified: true, bio: 'Covering startup culture, fundraising, and founder stories.' },
    { id: 'cr_6', name: 'GamingNexus', username: '@gamingnexus', platforms: ['youtube', 'tiktok', 'twitter'], contentType: 'gaming', followers: 567_000, engagement: 5.5, avgViews: 89_000, rate: '$600-1200/post', avatarInitial: 'G', verified: true, bio: 'Gaming reviews, esports coverage, and live streams.' },
    { id: 'cr_7', name: 'DesignDaily', username: '@designdaily', platforms: ['instagram', 'twitter', 'tiktok'], contentType: 'design', followers: 198_000, engagement: 4.8, avgViews: 35_000, rate: '$400-800/post', avatarInitial: 'D', verified: false, bio: 'UI/UX designer sharing tips, case studies, and design inspiration.' },
    { id: 'cr_8', name: 'TravelWithLee', username: '@travelwithlee', platforms: ['instagram', 'youtube', 'tiktok'], contentType: 'travel', followers: 750_000, engagement: 6.4, avgViews: 180_000, rate: '$1500-3000/post', avatarInitial: 'T', verified: true, bio: 'Full-time traveler. Destination guides, travel hacks, and vlog content.' },
  ];
}

function getMockRequests() {
  return [
    { id: 'req_1', from: '@indie_dev_mike', platform: 'twitter', contentDesc: 'New productivity app for developers', budget: '$200', status: 'PENDING', createdAt: '2026-03-04T10:00:00Z' },
    { id: 'req_2', from: '@healthyeats_co', platform: 'instagram', contentDesc: 'Organic meal prep service launch', budget: '$500', status: 'ACCEPTED', createdAt: '2026-03-03T14:30:00Z' },
    { id: 'req_3', from: '@saas_startup', platform: 'linkedin', contentDesc: 'B2B analytics platform promotion', budget: '$350', status: 'PENDING', createdAt: '2026-03-02T09:15:00Z' },
    { id: 'req_4', from: '@game_studio_x', platform: 'tiktok', contentDesc: 'Indie game early access promotion', budget: '$150', status: 'DECLINED', createdAt: '2026-03-01T16:45:00Z' },
  ];
}
