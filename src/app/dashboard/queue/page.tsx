'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const statusColors: Record<string, string> = {
  DRAFT: 'secondary',
  SCHEDULED: 'default',
  POSTING: 'default',
  PUBLISHED: 'default',
  FAILED: 'destructive',
};

export default function QueuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'queue'],
    queryFn: async () => {
      const res = await fetch('/api/posts?limit=50');
      return res.json();
    },
  });

  const posts = data?.posts || [];
  const scheduled = posts.filter((p: any) => p.status === 'SCHEDULED');
  const drafts = posts.filter((p: any) => p.status === 'DRAFT');
  const published = posts.filter((p: any) => p.status === 'PUBLISHED');
  const failed = posts.filter((p: any) => p.status === 'FAILED');

  const PostList = ({ items }: { items: any[] }) => (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No posts here</p>
      ) : (
        items.map((post: any) => (
          <div key={post.id} className="flex items-start justify-between rounded-lg border p-4">
            <div className="flex-1">
              <p className="font-medium">
                {post.title || post.content?.substring(0, 100) || 'Untitled'}
              </p>
              {post.scheduledAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                </p>
              )}
              {post.publishedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Published: {new Date(post.publishedAt).toLocaleString()}
                </p>
              )}
              {post.errorMessage && (
                <p className="mt-1 text-xs text-destructive">{post.errorMessage}</p>
              )}
              <div className="mt-2 flex gap-2">
                {post.targets?.map((t: any) => (
                  <Badge key={t.id} variant="outline" className="text-xs">
                    {t.socialAccount?.platform} — {t.socialAccount?.username}
                  </Badge>
                ))}
              </div>
            </div>
            <Badge variant={statusColors[post.status] as any || 'secondary'}>
              {post.status}
            </Badge>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Post Queue</h1>
        <p className="text-muted-foreground">Manage your scheduled, draft, and published posts</p>
      </div>

      <Tabs defaultValue="scheduled">
        <TabsList>
          <TabsTrigger value="scheduled">
            Scheduled ({isLoading ? '...' : scheduled.length})
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts ({isLoading ? '...' : drafts.length})
          </TabsTrigger>
          <TabsTrigger value="published">
            Published ({isLoading ? '...' : published.length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed ({isLoading ? '...' : failed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled"><PostList items={scheduled} /></TabsContent>
        <TabsContent value="drafts"><PostList items={drafts} /></TabsContent>
        <TabsContent value="published"><PostList items={published} /></TabsContent>
        <TabsContent value="failed"><PostList items={failed} /></TabsContent>
      </Tabs>
    </div>
  );
}
