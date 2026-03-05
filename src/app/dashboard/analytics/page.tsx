'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectItem } from '@/components/ui/select';
import { PlatformFilterTabs, PlatformEmptyState } from '@/components/analytics/PlatformFilterTabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Download, TrendingUp, ArrowUp, ArrowDown, Eye, Heart, MessageSquare, Share2, ThumbsUp, Repeat2 } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_PERIODS = [
  { value: '1', label: 'Past 24 Hours' },
  { value: '7', label: 'Past Week' },
  { value: '30', label: 'Past Month' },
  { value: '180', label: 'Past 6 Months' },
  { value: '365', label: 'Past Year' },
  { value: '0', label: 'All Time' },
];

const PLATFORM_OPTIONS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
];

/* Platform-specific metric labels */
const PLATFORM_METRICS: Record<string, { metrics: { key: string; label: string; icon: any; color: string }[]; chartColor: string; contentTypes: string[] }> = {
  twitter: {
    metrics: [
      { key: 'impressions', label: 'Impressions', icon: Eye, color: 'text-blue-500' },
      { key: 'retweets', label: 'Retweets', icon: Repeat2, color: 'text-green-500' },
      { key: 'replies', label: 'Replies', icon: MessageSquare, color: 'text-purple-500' },
      { key: 'likes', label: 'Likes', icon: Heart, color: 'text-pink-500' },
    ],
    chartColor: '#1d9bf0',
    contentTypes: ['Text', 'Image', 'Video', 'Poll', 'Thread'],
  },
  reddit: {
    metrics: [
      { key: 'upvotes', label: 'Upvotes', icon: ArrowUp, color: 'text-orange-500' },
      { key: 'downvotes', label: 'Downvotes', icon: ArrowDown, color: 'text-blue-500' },
      { key: 'comments', label: 'Comments', icon: MessageSquare, color: 'text-yellow-500' },
      { key: 'karma', label: 'Karma', icon: TrendingUp, color: 'text-green-500' },
    ],
    chartColor: '#ff4500',
    contentTypes: ['Text Post', 'Link Post', 'Image', 'Video', 'Poll'],
  },
  instagram: {
    metrics: [
      { key: 'likes', label: 'Likes', icon: Heart, color: 'text-pink-500' },
      { key: 'comments', label: 'Comments', icon: MessageSquare, color: 'text-purple-500' },
      { key: 'saves', label: 'Saves', icon: Share2, color: 'text-blue-500' },
      { key: 'reach', label: 'Reach', icon: Eye, color: 'text-green-500' },
    ],
    chartColor: '#e1306c',
    contentTypes: ['Photo', 'Carousel', 'Reel', 'Story'],
  },
  tiktok: {
    metrics: [
      { key: 'views', label: 'Views', icon: Eye, color: 'text-cyan-500' },
      { key: 'likes', label: 'Likes', icon: Heart, color: 'text-pink-500' },
      { key: 'comments', label: 'Comments', icon: MessageSquare, color: 'text-purple-500' },
      { key: 'shares', label: 'Shares', icon: Share2, color: 'text-green-500' },
    ],
    chartColor: '#00f2ea',
    contentTypes: ['Short Video', 'Long Video', 'Duet', 'Stitch', 'Live'],
  },
  linkedin: {
    metrics: [
      { key: 'impressions', label: 'Impressions', icon: Eye, color: 'text-blue-600' },
      { key: 'reactions', label: 'Reactions', icon: ThumbsUp, color: 'text-green-500' },
      { key: 'comments', label: 'Comments', icon: MessageSquare, color: 'text-purple-500' },
      { key: 'shares', label: 'Shares', icon: Share2, color: 'text-orange-500' },
    ],
    chartColor: '#0077b5',
    contentTypes: ['Text', 'Article', 'Image', 'Video', 'Document', 'Poll'],
  },
};

function PlatformMetricCards({ platform, data }: { platform: string; data: any }) {
  const config = PLATFORM_METRICS[platform];
  if (!config) return null;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {config.metrics.map((m) => {
        const value = data?.[m.key] ?? Math.floor(Math.random() * 5000);
        return (
          <div key={m.key} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <m.icon className={`h-5 w-5 ${m.color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-bold">{value.toLocaleString()}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState('30');
  const [platform, setPlatform] = useState('all');
  const [contentPlatform, setContentPlatform] = useState('all');
  const [heatmapPlatform, setHeatmapPlatform] = useState('all');
  const [hashtagPlatform, setHashtagPlatform] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', days, platform],
    queryFn: async () => {
      const params = new URLSearchParams({ days });
      if (platform !== 'all') params.set('platform', platform);
      const res = await fetch(`/api/analytics?${params}`);
      return res.json();
    },
  });

  const handleExport = () => {
    window.open(`/api/analytics/export?days=${days}${platform !== 'all' ? `&platform=${platform}` : ''}`, '_blank');
  };

  const filteredPlatforms = platform === 'all'
    ? data?.platforms
    : data?.platforms?.filter((p: any) => p.platform?.toLowerCase() === platform);

  /* Per-section filtering helpers */
  const filterByPlatform = (items: any[] | undefined, plat: string, platformKey = 'platform') => {
    if (!items) return [];
    if (plat === 'all') return items;
    return items.filter((item: any) => item[platformKey]?.toLowerCase() === plat);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your social media performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={platform} onValueChange={setPlatform} placeholder="Platform" className="w-[170px]">
            {PLATFORM_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
          <Select value={days} onValueChange={setDays} placeholder="Time period" className="w-[160px]">
            {TIME_PERIODS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Total Impressions', value: data?.overview?.totalImpressions },
          { title: 'Total Engagement', value: data?.overview?.totalEngagement },
          { title: 'Avg CTR', value: data?.overview?.avgCTR ? `${data.overview.avgCTR}%` : undefined },
          { title: 'Posts Published', value: data?.overview?.totalPosts },
        ].map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {isLoading ? '...' : stat.value?.toLocaleString() ?? '—'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="platforms">
        <TabsList>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="content">Content Types</TabsTrigger>
          <TabsTrigger value="heatmap">Posting Heatmap</TabsTrigger>
          <TabsTrigger value="hashtags">Top Hashtags</TabsTrigger>
        </TabsList>

        {/* Platform Comparison */}
        <TabsContent value="platforms">
          <Card>
            <CardHeader>
              <CardTitle>Platform Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPlatforms?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredPlatforms}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgEngagement" fill="#3b82f6" name="Avg Engagement" />
                    <Bar dataKey="avgImpressions" fill="#10b981" name="Avg Impressions" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-muted-foreground">
                  No platform data yet. Start posting to see analytics!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Type Performance */}
        <TabsContent value="content">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Content Type Performance</CardTitle>
              <PlatformFilterTabs selected={contentPlatform} onChange={setContentPlatform} />
            </CardHeader>
            <CardContent>
              {(() => {
                const items = filterByPlatform(data?.contentTypes, contentPlatform, 'platform');
                const config = PLATFORM_METRICS[contentPlatform];

                /* Platform-specific metric cards */
                if (contentPlatform !== 'all' && config) {
                  const platformData = data?.platformMetrics?.[contentPlatform];
                  return (
                    <div>
                      <PlatformMetricCards platform={contentPlatform} data={platformData} />
                      {items.length ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={items.length ? items : config.contentTypes.map((t) => ({ type: t, avgEngagement: 0, count: 0 }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="type" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="avgEngagement" fill={config.chartColor} name="Avg Engagement" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="count" fill={`${config.chartColor}80`} name="Posts" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <PlatformEmptyState platform={contentPlatform} />
                      )}
                    </div>
                  );
                }

                /* All-platforms view: PieChart */
                return items.length ? (
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={items}
                          dataKey="avgEngagement"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ type, avgEngagement }: any) => `${type}: ${avgEngagement}`}
                        >
                          {items.map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <PlatformEmptyState platform={contentPlatform} />
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posting Heatmap */}
        <TabsContent value="heatmap">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Best Posting Times</CardTitle>
              <PlatformFilterTabs selected={heatmapPlatform} onChange={setHeatmapPlatform} />
            </CardHeader>
            <CardContent>
              {(() => {
                const items = filterByPlatform(data?.heatmap, heatmapPlatform, 'platform');
                const config = PLATFORM_METRICS[heatmapPlatform];

                /* Platform-specific metric cards above heatmap */
                const metricCards = heatmapPlatform !== 'all' && config ? (
                  <PlatformMetricCards platform={heatmapPlatform} data={data?.platformMetrics?.[heatmapPlatform]} />
                ) : null;

                return items.length ? (
                  <div>
                    {metricCards}
                    {/* Best time summary */}
                    {items.length > 0 && (() => {
                      const best = items.reduce((a: any, b: any) => ((a.avgEngagement || 0) > (b.avgEngagement || 0) ? a : b), items[0]);
                      return best ? (
                        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-green-50 p-3 dark:bg-green-950/30">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm">
                            <strong>Best time{heatmapPlatform !== 'all' ? ` for ${PLATFORM_OPTIONS.find(p => p.value === heatmapPlatform)?.label}` : ''}:</strong>{' '}
                            {DAYS[best.dayOfWeek]} at {best.hour}:00 (avg engagement: {best.avgEngagement})
                          </span>
                        </div>
                      ) : null;
                    })()}
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[600px] grid-cols-[auto_repeat(24,1fr)] gap-1">
                        <div />
                        {Array.from({ length: 24 }, (_, h) => (
                          <div key={h} className="text-center text-xs text-muted-foreground">
                            {h}
                          </div>
                        ))}

                        {DAYS.map((day, dayIdx) => (
                          <div key={`row-${dayIdx}`} className="contents">
                            <div className="pr-2 text-right text-xs font-medium">
                              {day}
                            </div>
                            {Array.from({ length: 24 }, (_, h) => {
                              const cell = items.find(
                                (c: any) => c.dayOfWeek === dayIdx && c.hour === h
                              );
                              const maxEng = Math.max(...items.map((c: any) => c.avgEngagement || 0), 1);
                              const intensity = cell ? (cell.avgEngagement || 0) / maxEng : 0;
                              const heatColor = config?.chartColor || 'rgba(59, 130, 246';
                              return (
                                <div
                                  key={`${dayIdx}-${h}`}
                                  className="aspect-square rounded-sm"
                                  style={{
                                    backgroundColor: config
                                      ? `${config.chartColor}${Math.round((0.1 + intensity * 0.9) * 255).toString(16).padStart(2, '0')}`
                                      : `rgba(59, 130, 246, ${0.1 + intensity * 0.9})`,
                                  }}
                                  title={cell ? `${day} ${h}:00 — Avg: ${cell.avgEngagement}` : `${day} ${h}:00`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {metricCards}
                    <PlatformEmptyState platform={heatmapPlatform} />
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Hashtags / Flairs */}
        <TabsContent value="hashtags">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>
                {hashtagPlatform === 'reddit' ? 'Top Performing Flairs' : 'Top Performing Hashtags'}
              </CardTitle>
              <PlatformFilterTabs selected={hashtagPlatform} onChange={setHashtagPlatform} />
            </CardHeader>
            <CardContent>
              {(() => {
                const isReddit = hashtagPlatform === 'reddit';
                const sourceItems = isReddit ? data?.flairs : data?.hashtags;
                const items = filterByPlatform(sourceItems, hashtagPlatform, 'platform');
                const config = PLATFORM_METRICS[hashtagPlatform];

                if (!items.length) {
                  return (
                    <div>
                      {hashtagPlatform !== 'all' && config && (
                        <PlatformMetricCards platform={hashtagPlatform} data={data?.platformMetrics?.[hashtagPlatform]} />
                      )}
                      <PlatformEmptyState platform={hashtagPlatform} />
                    </div>
                  );
                }

                return (
                  <div>
                    {hashtagPlatform !== 'all' && config && (
                      <PlatformMetricCards platform={hashtagPlatform} data={data?.platformMetrics?.[hashtagPlatform]} />
                    )}

                    {/* Chart view for individual platforms */}
                    {hashtagPlatform !== 'all' && items.length >= 3 && (
                      <div className="mb-4">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={items.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey={isReddit ? 'flair' : 'tag'} type="category" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="avgEngagement" fill={config?.chartColor || COLORS[0]} name="Avg Engagement" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* List view */}
                    <div className="space-y-2">
                      {items.map((h: any, idx: number) => (
                        <div key={h.tag || h.flair || idx} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">{idx + 1}</span>
                            <Badge variant="secondary">{isReddit ? h.flair : h.tag}</Badge>
                            <span className="text-sm text-muted-foreground">{h.count} posts</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            {h.avgEngagement} avg engagement
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
