'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectItem } from '@/components/ui/select';
import { BarChart3, Calendar, TrendingUp, Users } from 'lucide-react';

const TIME_PERIODS = [
  { label: '24 Hours', value: '1' },
  { label: '7 Days', value: '7' },
  { label: '30 Days', value: '30' },
  { label: '1 Year', value: '365' },
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

  const stats = data?.analytics?.overview;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your social media performance</p>
        </div>
        <Select value={days} onValueChange={setDays} placeholder="Time Period">
          {TIME_PERIODS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Total Posts', value: stats?.totalPosts ?? '—', icon: Calendar, color: 'text-blue-500' },
          { title: 'Impressions', value: stats?.totalImpressions?.toLocaleString() ?? '—', icon: TrendingUp, color: 'text-green-500' },
          { title: 'Engagement', value: stats?.totalEngagement?.toLocaleString() ?? '—', icon: BarChart3, color: 'text-purple-500' },
          { title: 'Accounts', value: Array.isArray(data?.accounts) ? data.accounts.length : '—', icon: Users, color: 'text-orange-500' },
        ].map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{isLoading ? '...' : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
              {data.posts.posts.map((post: any) => (
                <div key={post.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {post.title || post.content?.substring(0, 80) || 'Untitled'}
                    </p>
                    <div className="mt-1 flex gap-2">
                      {post.targets?.map((t: any) => (
                        <Badge key={t.id} variant="secondary" className="text-xs">
                          {t.socialAccount?.platform}
                        </Badge>
                      ))}
                    </div>
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
              ))}
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
                <div key={acc.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {acc.platform.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{acc.username}</p>
                    <p className="text-xs text-muted-foreground">{acc.platform}</p>
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
