'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useComposeStore } from '@/store/compose';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Wand2, Shield, Send, Clock } from 'lucide-react';

export default function ComposePage() {
  const { content, targets, scheduledAt, setContent, addTarget, removeTarget, setScheduledAt, reset } = useComposeStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aiTopic, setAiTopic] = useState('');
  const [subredditCheck, setSubredditCheck] = useState<any>(null);

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await fetch('/api/accounts/link');
      return res.json();
    },
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          targets,
          scheduledAt: scheduledAt || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create post');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: scheduledAt ? 'Post scheduled!' : 'Post created as draft' });
      reset();
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const generateCaption = useMutation({
    mutationFn: async () => {
      const platform = targets[0]?.platform || 'twitter';
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, platform }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate caption');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setContent({ text: data.caption });
      toast({ title: 'Caption generated!' });
    },
    onError: (err: Error) => {
      toast({ title: 'AI Error', description: err.message, variant: 'destructive' });
    },
  });

  const checkRedditRules = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/reddit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subreddit: content.subreddit,
          title: content.title || '',
          content: content.text,
          postType: content.link ? 'link' : 'text',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSubredditCheck(data);
    },
    onError: (err: Error) => {
      toast({ title: 'Rule Check Failed', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compose Post</h1>
        <p className="text-muted-foreground">Create and schedule posts across platforms</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Editor */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title (Reddit)</Label>
                <Input
                  id="title"
                  placeholder="Post title..."
                  value={content.title || ''}
                  onChange={(e) => setContent({ title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="What's on your mind?"
                  className="min-h-[150px]"
                  value={content.text || ''}
                  onChange={(e) => setContent({ text: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {(content.text || '').length} characters
                </p>
              </div>

              <div>
                <Label htmlFor="link">Link (optional)</Label>
                <Input
                  id="link"
                  placeholder="https://..."
                  value={content.link || ''}
                  onChange={(e) => setContent({ link: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="subreddit">Subreddit (Reddit only)</Label>
                <Input
                  id="subreddit"
                  placeholder="e.g. programming"
                  value={content.subreddit || ''}
                  onChange={(e) => setContent({ subreddit: e.target.value })}
                />
              </div>

              {/* AI Caption Generator */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Wand2 className="h-4 w-4 text-purple-500" /> AI Caption Generator
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Describe your topic..."
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                  />
                  <Button
                    onClick={() => generateCaption.mutate()}
                    disabled={!aiTopic || generateCaption.isPending}
                    size="sm"
                  >
                    {generateCaption.isPending ? 'Generating...' : 'Generate'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reddit Rule Check */}
          {content.subreddit && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-500" />
                  Reddit Rule Compliance
                </CardTitle>
                <CardDescription>
                  Check if your post complies with r/{content.subreddit} rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => checkRedditRules.mutate()}
                  disabled={checkRedditRules.isPending}
                  variant="outline"
                  className="mb-4"
                >
                  {checkRedditRules.isPending ? 'Analyzing...' : 'Check Compliance'}
                </Button>

                {subredditCheck && (
                  <div className="space-y-3">
                    <Badge variant={subredditCheck.allowed ? 'default' : 'destructive'}>
                      {subredditCheck.allowed ? '✓ Compliant' : '✗ Violations Found'}
                    </Badge>

                    {subredditCheck.violations?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-destructive">Violations:</p>
                        <ul className="list-inside list-disc text-sm">
                          {subredditCheck.violations.map((v: string, i: number) => (
                            <li key={i}>{v}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {subredditCheck.suggestions?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium">Suggestions:</p>
                        <ul className="list-inside list-disc text-sm text-muted-foreground">
                          {subredditCheck.suggestions.map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {subredditCheck.recommended_flair && (
                      <p className="text-sm">
                        Recommended flair: <Badge variant="secondary">{subredditCheck.recommended_flair}</Badge>
                      </p>
                    )}

                    {subredditCheck.best_time_to_post && (
                      <p className="text-sm text-muted-foreground">
                        Best time to post: {subredditCheck.best_time_to_post}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar: Targets + Schedule */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Publish To</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(accounts) && accounts.length > 0 ? (
                <div className="space-y-2">
                  {accounts.map((acc: any) => {
                    const isSelected = targets.some((t) => t.socialAccountId === acc.id);
                    return (
                      <button
                        key={acc.id}
                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                        onClick={() =>
                          isSelected
                            ? removeTarget(acc.id)
                            : addTarget({
                                socialAccountId: acc.id,
                                platform: acc.platform.toLowerCase(),
                              })
                        }
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {acc.platform.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{acc.username}</p>
                          <p className="text-xs text-muted-foreground">{acc.platform}</p>
                        </div>
                        {isSelected && <Badge>Selected</Badge>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No accounts connected yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="datetime-local"
                value={scheduledAt || ''}
                onChange={(e) => setScheduledAt(e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to save as draft
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => createPost.mutate()}
              disabled={targets.length === 0 || createPost.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              {createPost.isPending
                ? 'Creating...'
                : scheduledAt
                ? 'Schedule Post'
                : 'Save Draft'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
