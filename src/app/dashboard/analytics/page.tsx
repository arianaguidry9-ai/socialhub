'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectItem } from '@/components/ui/select';
import { PlatformFilterTabs, PlatformEmptyState } from '@/components/analytics/PlatformFilterTabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, TrendingUp } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_PERIODS = [
  { value: '1', label: 'Past 24 Hours' },
  { value: '7', label: 'Past Week' },
  { value: '30', label: 'Past Month' },
  { value: '365', label: 'Past Year' },
];

const PLATFORM_OPTIONS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
];

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
                return items.length ? (
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
                            return (
                              <div
                                key={`${dayIdx}-${h}`}
                                className="aspect-square rounded-sm"
                                style={{
                                  backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.9})`,
                                }}
                                title={cell ? `${day} ${h}:00 — Avg: ${cell.avgEngagement}` : `${day} ${h}:00`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <PlatformEmptyState platform={heatmapPlatform} />
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
                return items.length ? (
                  <div className="space-y-2">
                    {items.map((h: any, idx: number) => (
                      <div key={h.tag || h.flair || idx} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
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
                ) : (
                  <PlatformEmptyState platform={hashtagPlatform} />
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
