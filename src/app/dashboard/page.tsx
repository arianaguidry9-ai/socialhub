'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectItem } from '@/components/ui/select';
import { BarChart3, Calendar, TrendingUp, Users, Heart, Eye, MessageSquare, Repeat2, BookMarked, MessageCircle, UserCheck, FileText } from 'lucide-react';

const TIME_PERIODS = [
  { label: 'Past 24 Hours', value: '1' },
  { label: 'Past Week', value: '7' },
  { label: 'Past Month', value: '30' },
  { label: 'Past 6 Months', value: '180' },
  { label: 'Past Year', value: '365' },
  { label: 'All Time', value: '0' },
];

export default function DashboardPage() {
  const [days, setDays] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', days],
    queryFn: async () => {
      const [analyticsRes, postsRes, accountsRes] = await Promise.all([
        fetch(`/api/analytics?days=${days}`),
        fetch('/api/posts?limit=5'),
        fetch('/api/accounts/link'),
      ]);
      return {
        analytics: await analyticsRes.json(),
        posts: await postsRes.json(),
        accounts: await accountsRes.json(),
      };
    },
  });

  // Fetch live Twitter stats if a Twitter account is connected
  const twitterAccount = Array.isArray(data?.accounts)
    ? data.accounts.find((a: any) => a.platform === 'TWITTER')
    : null;

  const { data: liveTwitter, isLoading: liveLoading } = useQuery({
    queryKey: ['live-twitter'],
    queryFn: () => fetch('/api/analytics/platform?platform=twitter').then((r) => r.json()),
    enabled: !!twitterAccount,
    staleTime: 2 * 60 * 1000, // 2 min
  });

  const stats = data?.analytics?.overview;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-base text-muted-foreground">Overview of your social media performance</p>
        </div>
        <Select value={days} onValueChange={setDays} placeholder="Time Period" className="w-[200px]">
          {TIME_PERIODS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Total Posts', value: stats?.totalPosts ?? '—', icon: Calendar, color: 'text-blue-500' },
          { title: 'Impressions', value: stats?.totalImpressions?.toLocaleString() ?? '—', icon: TrendingUp, color: 'text-green-500' },
          { title: 'Engagement', value: stats?.totalEngagement?.toLocaleString() ?? '—', icon: BarChart3, color: 'text-purple-500' },
          { title: 'Accounts', value: Array.isArray(data?.accounts) ? data.accounts.length : '—', icon: Users, color: 'text-orange-500' },
        ].map((stat) => (
          <Card key={stat.title} className="glass-card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{isLoading ? '...' : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Twitter / X Account Stats */}
      {twitterAccount && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white text-sm font-bold">𝕏</div>
            <div>
              <CardTitle className="text-base">
                {liveLoading ? 'Loading…' : liveTwitter?.profile ? `@${liveTwitter.profile.username}` : 'X / Twitter'}
              </CardTitle>
              {liveTwitter?.profile?.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{liveTwitter.profile.description}</p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {liveTwitter?.error ? (
              <p className="text-sm text-destructive">{liveTwitter.error}</p>
            ) : (
              <>
                {/* Profile stat row */}
                <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Followers',   value: liveTwitter?.profile?.followers,  icon: Users },
                    { label: 'Following',   value: liveTwitter?.profile?.following,  icon: UserCheck },
                    { label: 'Total Tweets',value: liveTwitter?.profile?.tweetCount, icon: FileText },
                    { label: 'Listed',      value: liveTwitter?.profile?.listedCount,icon: BarChart3 },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                      <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-bold">{liveLoading ? '…' : (s.value?.toLocaleString() ?? '—')}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent tweets engagement row */}
                {(liveTwitter?.recentTweets?.length ?? 0) > 0 && (
                  <>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Last {liveTwitter.recentTweets.length} tweets (totals)
                    </p>
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: 'Likes',     value: liveTwitter.totals?.likes,     icon: Heart,         color: 'text-pink-500' },
                        { label: 'Retweets',  value: liveTwitter.totals?.retweets,  icon: Repeat2,       color: 'text-green-500' },
                        { label: 'Replies',   value: liveTwitter.totals?.replies,   icon: MessageCircle, color: 'text-blue-500' },
                        { label: 'Bookmarks', value: liveTwitter.totals?.bookmarks, icon: BookMarked,    color: 'text-purple-500' },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                          <s.icon className={`h-4 w-4 ${s.color} shrink-0`} />
                          <div>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                            <p className="text-lg font-bold">{s.value?.toLocaleString() ?? '—'}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Recent tweets list */}
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Tweets</p>
                    <div className="space-y-2">
                      {liveTwitter.recentTweets.slice(0, 5).map((t: any) => (
                        <a
                          key={t.id}
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start justify-between gap-4 rounded-lg border border-border/40 p-3 transition-colors hover:bg-accent/40"
                        >
                          <p className="text-sm line-clamp-2 flex-1">{t.text}</p>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-pink-400" />{t.likes}</span>
                            <span className="flex items-center gap-1"><Repeat2 className="h-3 w-3 text-green-400" />{t.retweets}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-blue-400" />{t.replies}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Posts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : data?.posts?.posts?.length ? (
            <div className="space-y-3">
              {data.posts.posts.map((post: any) => {
                // Aggregate metrics across all targets
                const metrics = { impressions: 0, likes: 0, comments: 0 };
                post.targets?.forEach((t: any) => {
                  const m = t.metrics?.[0];
                  if (m) {
                    metrics.impressions += m.impressions || 0;
                    metrics.likes += m.likes || 0;
                    metrics.comments += m.comments || 0;
                  }
                });

                return (
                  <div key={post.id} className="flex items-center justify-between rounded-xl border border-border/40 p-4 transition-colors hover:bg-accent/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {post.title || post.content?.substring(0, 80) || 'Untitled'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {post.targets?.map((t: any) => (
                          <Badge key={t.id} variant="secondary" className="text-xs">
                            {t.socialAccount?.platform}
                          </Badge>
                        ))}
                      </div>
                      {/* Metrics row */}
                      {post.status === 'PUBLISHED' && (metrics.impressions > 0 || metrics.likes > 0 || metrics.comments > 0) && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {metrics.impressions.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5 text-red-500/70" />
                            {metrics.likes.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5 text-blue-500/70" />
                            {metrics.comments.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={
                        post.status === 'PUBLISHED' ? 'default' :
                        post.status === 'FAILED' ? 'destructive' :
                        'secondary'
                      }
                    >
                      {post.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No posts yet. Create your first post!</p>
          )}
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(data?.accounts) && data.accounts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.accounts.map((acc: any) => (
                <div key={acc.id} className="flex items-center gap-4 rounded-xl border border-border/40 p-4 transition-colors hover:bg-accent/40">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">
                    {acc.platform.charAt(0)}
                  </div>
                  <div>
                    <p className="text-base font-medium">{acc.username}</p>
                    <p className="text-sm text-muted-foreground">{acc.platform}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No accounts connected. Go to Accounts to connect.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
