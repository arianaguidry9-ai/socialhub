'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { signIn } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ExternalLink, Trash2, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';

const availablePlatforms = [
  { id: 'reddit',    name: 'Reddit',       description: 'Post to subreddits, track karma',        color: 'bg-orange-500',  icon: 'R' },
  { id: 'twitter',   name: 'X / Twitter',  description: 'Tweets, threads, engagement',             color: 'bg-gray-900 dark:bg-gray-600', icon: '𝕏' },
  { id: 'instagram', name: 'Instagram',    description: 'Feed posts, reels, stories',              color: 'bg-gradient-to-br from-purple-500 to-pink-500', icon: 'I' },
  { id: 'linkedin',  name: 'LinkedIn',     description: 'Professional posts, articles',            color: 'bg-blue-600',    icon: 'in' },
  { id: 'facebook',  name: 'Facebook',     description: 'Pages, groups, engagement',               color: 'bg-blue-500',    icon: 'f' },
  { id: 'tiktok',    name: 'TikTok',       description: 'Short-form video content',                color: 'bg-black dark:bg-gray-700',      icon: '♪' },
  { id: 'youtube',   name: 'YouTube',      description: 'Video uploads, community posts',          color: 'bg-red-600',     icon: '▶' },
  { id: 'pinterest', name: 'Pinterest',    description: 'Pins, boards, visual content',            color: 'bg-red-500',     icon: 'P' },
  { id: 'mastodon',  name: 'Mastodon',     description: 'Fediverse toots, engagement',             color: 'bg-indigo-500',  icon: 'M' },
  { id: 'bluesky',   name: 'Bluesky',      description: 'Posts on the AT Protocol network',        color: 'bg-sky-500',     icon: '🦋' },
];

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [linkStatus, setLinkStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Auto-sync after OAuth return ─────────────────────────────────────────
  // When the user is redirected back here with ?linked=<provider>, the OAuth
  // tokens have been stored in the `accounts` collection by the adapter.
  // We call POST /api/accounts/link to promote them into the `socialAccounts`
  // display collection and then clean up the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedProvider = params.get('linked');
    if (!linkedProvider) return;

    // Remove the search param immediately so a page refresh doesn't re-link
    window.history.replaceState({}, '', '/dashboard/accounts');

    fetch('/api/accounts/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: linkedProvider }),
    })
      .then(async (res) => {
        if (res.ok) {
          setLinkStatus({ type: 'success', message: `${linkedProvider} account connected!` });
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
        } else {
          const data = await res.json().catch(() => ({}));
          setLinkStatus({ type: 'error', message: data.error ?? 'Failed to sync account.' });
        }
      })
      .catch(() => {
        setLinkStatus({ type: 'error', message: 'Network error while syncing account.' });
      });
  }, [queryClient]);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await fetch('/api/accounts/link');
      return res.json();
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const connectedPlatforms = new Set(
    Array.isArray(accounts)
      ? accounts.map((a: any) => a.platform.toLowerCase())
      : []
  );

  const filteredPlatforms = availablePlatforms.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConnect = async (platformId: string) => {
    setAddDialogOpen(false);
    setLinkStatus(null);

    // Signal to the auth adapter that this is a "connect" (add to existing
    // user) rather than a fresh sign-in.  The endpoint sets a short-lived,
    // signed httpOnly cookie that the NextAuth route handler picks up during
    // the OAuth callback to link to the current user instead of creating a
    // new one.
    try {
      await fetch('/api/accounts/link-start');
    } catch {
      // Non-fatal — proceed; worst case: a duplicate user is not created
      // because our adapter still does e-mail deduplication as a fallback.
    }

    // callbackUrl carries the provider name back so the useEffect above
    // can call POST /api/accounts/link to sync the socialAccounts record.
    signIn(platformId, { callbackUrl: `/dashboard/accounts?linked=${platformId}` });
  };

  return (
    <div className="space-y-6">

      {/* OAuth return status banner */}
      {linkStatus && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
            linkStatus.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {linkStatus.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {linkStatus.message}
          <button
            className="ml-auto text-xs opacity-60 hover:opacity-100"
            onClick={() => setLinkStatus(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Connected Accounts</h1>
          <p className="text-muted-foreground">Manage your social media connections</p>
        </div>
        <Button
          className="bg-gradient-to-r from-violet-600 to-blue-500 text-white hover:from-violet-700 hover:to-blue-600"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Social Account</DialogTitle>
              <p className="text-sm text-muted-foreground">Connect a social media platform to manage it from SocialHub</p>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search platforms..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                {filteredPlatforms.map((platform) => {
                  const isConnected = connectedPlatforms.has(platform.id);
                  return (
                    <button
                      key={platform.id}
                      className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition-all hover:bg-accent hover:shadow-sm dark:border-gray-700 disabled:opacity-60"
                      onClick={() => handleConnect(platform.id)}
                      disabled={isConnected}
                    >
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${platform.color} text-sm font-bold text-white`}>
                        {platform.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{platform.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{platform.description}</p>
                      </div>
                      {isConnected ? (
                        <Badge variant="secondary" className="shrink-0">Connected</Badge>
                      ) : (
                        <Plus className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
                {filteredPlatforms.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No platforms found</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>

      {/* Connected Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Accounts</CardTitle>
          <CardDescription>
            {Array.isArray(accounts)
              ? `${accounts.length} account(s) connected`
              : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : Array.isArray(accounts) && accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((acc: any) => {
                const platform = availablePlatforms.find(
                  (p) => p.id === acc.platform.toLowerCase()
                );
                return (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${platform?.color ?? 'bg-primary'} text-lg font-bold text-white`}>
                        {platform?.icon ?? acc.platform.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{acc.username || acc.displayName}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{platform?.name ?? acc.platform}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Connected {new Date(acc.connectedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {acc.profileUrl && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={acc.profileUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        onClick={() => disconnectMutation.mutate(acc.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="rounded-full bg-violet-100 p-3 dark:bg-violet-900/30">
                <Plus className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">No accounts connected</p>
                <p className="text-sm text-muted-foreground">Add your first social media account to get started</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Connect Section */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Connect</CardTitle>
          <CardDescription>Add more platforms to manage from one place</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {availablePlatforms
              .filter((p) => !connectedPlatforms.has(p.id))
              .slice(0, 4)
              .map((platform) => (
                <button
                  key={platform.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition-all hover:bg-accent hover:shadow-sm dark:border-gray-700"
                  onClick={() => handleConnect(platform.id)}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${platform.color} text-sm font-bold text-white`}>
                    {platform.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{platform.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{platform.description}</p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
          </div>
          {availablePlatforms.filter((p) => !connectedPlatforms.has(p.id)).length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">All platforms connected!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
