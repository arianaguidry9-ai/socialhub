'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogClose } from '@/components/ui/dialog';

const statusColors: Record<string, string> = {
  DRAFT: 'secondary',
  SCHEDULED: 'default',
  POSTING: 'default',
  PUBLISHED: 'default',
  FAILED: 'destructive',
};

export default function QueuePage() {
  const [selectedPost, setSelectedPost] = useState<any>(null);

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
          <button
            key={post.id}
            className="flex w-full items-start justify-between rounded-lg border p-4 text-left transition-colors hover:bg-accent"
            onClick={() => setSelectedPost(post)}
          >
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
          </button>
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

      {/* Post Preview Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogClose onClose={() => setSelectedPost(null)} />
        <DialogHeader>
          <DialogTitle>Post Preview</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {selectedPost && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={statusColors[selectedPost.status] as any || 'secondary'}>
                  {selectedPost.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Created: {new Date(selectedPost.createdAt).toLocaleString()}
                </span>
              </div>

              {selectedPost.title && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Title</p>
                  <p className="text-lg font-semibold">{selectedPost.title}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground">Content</p>
                <div className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                  {selectedPost.content || 'No content'}
                </div>
              </div>

              {selectedPost.mediaUrls?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Media</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {selectedPost.mediaUrls.map((url: string, i: number) => (
                      <div key={i} className="overflow-hidden rounded-md border">
                        {url.match(/\.(mp4|webm|mov)$/i) ? (
                          <video src={url} controls className="w-full" />
                        ) : url.includes('redgifs.com') ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-24 items-center justify-center bg-muted text-xs text-muted-foreground hover:underline">
                            RedGifs Link
                          </a>
                        ) : (
                          <img src={url} alt="" className="w-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPost.scheduledAt && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Scheduled For</p>
                  <p className="text-sm">{new Date(selectedPost.scheduledAt).toLocaleString()}</p>
                </div>
              )}

              {selectedPost.publishedAt && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Published At</p>
                  <p className="text-sm">{new Date(selectedPost.publishedAt).toLocaleString()}</p>
                </div>
              )}

              {selectedPost.errorMessage && (
                <div>
                  <p className="text-xs font-medium text-destructive">Error</p>
                  <p className="text-sm text-destructive">{selectedPost.errorMessage}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground">Platforms</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {selectedPost.targets?.length > 0 ? (
                    selectedPost.targets.map((t: any) => (
                      <Badge key={t.id} variant="outline">
                        {t.socialAccount?.platform} — {t.socialAccount?.username}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No platforms selected</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
