'use client';

import { useQuery } from '@tanstack/react-query';
import { signIn } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';

const availablePlatforms = [
  { id: 'reddit', name: 'Reddit', description: 'Post to subreddits, track karma', color: 'bg-orange-500' },
  { id: 'twitter', name: 'X / Twitter', description: 'Tweets, threads, engagement', color: 'bg-black' },
  { id: 'instagram', name: 'Instagram', description: 'Feed posts, reels, stories', color: 'bg-pink-500' },
  { id: 'linkedin', name: 'LinkedIn', description: 'Professional posts, articles', color: 'bg-blue-600' },
];

export default function AccountsPage() {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await fetch('/api/accounts/link');
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Connected Accounts</h1>
        <p className="text-muted-foreground">Manage your social media connections</p>
      </div>

      {/* Connected Accounts */}
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
            <p>Loading...</p>
          ) : Array.isArray(accounts) && accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((acc: any) => (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {acc.platform.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{acc.username}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{acc.platform}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Connected {new Date(acc.connectedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {acc.profileUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={acc.profileUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No accounts connected yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Add Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Connect a Platform</CardTitle>
          <CardDescription>Link your social media accounts to start posting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {availablePlatforms.map((platform) => {
              const isConnected = Array.isArray(accounts) &&
                accounts.some((a: any) => a.platform === platform.id.toUpperCase());
              return (
                <button
                  key={platform.id}
                  className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => signIn(platform.id, { callbackUrl: '/dashboard/accounts' })}
                  disabled={isConnected}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${platform.color} text-sm font-bold text-white`}>
                    {platform.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{platform.name}</p>
                    <p className="text-xs text-muted-foreground">{platform.description}</p>
                  </div>
                  {isConnected ? (
                    <Badge>Connected</Badge>
                  ) : (
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
