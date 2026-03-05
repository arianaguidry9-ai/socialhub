'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, TrendingUp } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const res = await fetch('/api/analytics?days=30');
      return res.json();
    },
  });

  const handleExport = () => {
    window.open('/api/analytics/export?days=90', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your social media performance</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
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
              {data?.platforms?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.platforms}>
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
            <CardHeader>
              <CardTitle>Content Type Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.contentTypes?.length ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.contentTypes}
                        dataKey="avgEngagement"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ type, avgEngagement }: any) => `${type}: ${avgEngagement}`}
                      >
                        {data.contentTypes.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-12 text-center text-muted-foreground">No content data yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posting Heatmap */}
        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <CardTitle>Best Posting Times</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.heatmap?.length ? (
                <div className="overflow-x-auto">
                  <div className="grid min-w-[600px] grid-cols-[auto_repeat(24,1fr)] gap-1">
                    {/* Header: hours */}
                    <div />
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="text-center text-xs text-muted-foreground">
                        {h}
                      </div>
                    ))}

                    {/* Rows: days */}
                    {DAYS.map((day, dayIdx) => (
                      <>
                        <div key={`label-${dayIdx}`} className="pr-2 text-right text-xs font-medium">
                          {day}
                        </div>
                        {Array.from({ length: 24 }, (_, h) => {
                          const cell = data.heatmap.find(
                            (c: any) => c.dayOfWeek === dayIdx && c.hour === h
                          );
                          const maxEng = Math.max(...data.heatmap.map((c: any) => c.avgEngagement), 1);
                          const intensity = cell ? cell.avgEngagement / maxEng : 0;
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
                      </>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-muted-foreground">
                  Not enough data for heatmap. Keep posting!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Hashtags */}
        <TabsContent value="hashtags">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Hashtags</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.hashtags?.length ? (
                <div className="space-y-2">
                  {data.hashtags.map((h: any) => (
                    <div key={h.tag} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{h.tag}</Badge>
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
                <p className="py-12 text-center text-muted-foreground">
                  No hashtag data yet. Use hashtags in your posts!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
