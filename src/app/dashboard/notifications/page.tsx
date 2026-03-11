'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import {
  Bell, Heart, MessageSquare, Share2, UserPlus, AtSign,
  ExternalLink, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';

const PLATFORM_OPTIONS = [
  { label: 'All Platforms', value: 'all' },
  { label: 'Reddit', value: 'reddit' },
  { label: 'X / Twitter', value: 'twitter' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'LinkedIn', value: 'linkedin' },
];

const PLATFORM_META: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  reddit:    { label: 'Reddit',     icon: 'R', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/40' },
  twitter:   { label: 'X / Twitter', icon: 'X', color: 'text-gray-800 dark:text-gray-200',   bgColor: 'bg-gray-100 dark:bg-gray-800/40' },
  instagram: { label: 'Instagram',  icon: 'I', color: 'text-pink-600 dark:text-pink-400',     bgColor: 'bg-pink-100 dark:bg-pink-900/40' },
  tiktok:    { label: 'TikTok',     icon: 'T', color: 'text-cyan-600 dark:text-cyan-400',     bgColor: 'bg-cyan-100 dark:bg-cyan-900/40' },
  linkedin:  { label: 'LinkedIn',   icon: 'L', color: 'text-blue-600 dark:text-blue-400',     bgColor: 'bg-blue-100 dark:bg-blue-900/40' },
};

const NOTIF_ICONS: Record<string, { icon: typeof Heart; color: string }> = {
  like:     { icon: Heart,          color: 'text-red-500' },
  comment:  { icon: MessageSquare,  color: 'text-blue-500' },
  share:    { icon: Share2,         color: 'text-green-500' },
  follower: { icon: UserPlus,       color: 'text-purple-500' },
  mention:  { icon: AtSign,         color: 'text-amber-500' },
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const [platform, setPlatform] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['notifications', platform],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (platform !== 'all') params.set('platform', platform);
      params.set('limit', '50');
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const notifications = data?.notifications || [];

  const handleReply = (notifId: string, publishedUrl: string | null) => {
    const text = replyText[notifId];
    if (!text?.trim()) return;
    // Open the platform post in a new tab for now — real API integration would post the reply
    if (publishedUrl) {
      window.open(publishedUrl, '_blank', 'noopener,noreferrer');
    }
    setReplyText((prev) => ({ ...prev, [notifId]: '' }));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Activity from all your connected platforms in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Select value={platform} onValueChange={setPlatform} placeholder="Platform" className="w-[180px]">
            {PLATFORM_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Likes', type: 'like', icon: Heart, color: 'text-red-500' },
          { label: 'Comments', type: 'comment', icon: MessageSquare, color: 'text-blue-500' },
          { label: 'Shares', type: 'share', icon: Share2, color: 'text-green-500' },
          { label: 'New Followers', type: 'follower', icon: UserPlus, color: 'text-purple-500' },
        ].map((stat) => {
          const items = notifications.filter((n: any) => n.type === stat.type);
          const totalCount = items.reduce((sum: number, n: any) => sum + (n.count || 0), 0);
          return (
            <Card key={stat.type} className="glass-card-hover">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{isLoading ? '...' : totalCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  across {items.length} post{items.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Notification Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Activity Feed
          </CardTitle>
          <CardDescription>
            {platform === 'all'
              ? 'Showing notifications from all platforms'
              : `Showing notifications from ${PLATFORM_META[platform]?.label || platform}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Notifications will appear here as your posts get engagement
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif: any) => {
                const meta = PLATFORM_META[notif.platform];
                const notifMeta = NOTIF_ICONS[notif.type] || NOTIF_ICONS.like;
                const NotifIcon = notifMeta.icon;
                const isExpanded = expandedId === notif.id;

                return (
                  <div key={notif.id} className="rounded-xl border border-border/40 transition-colors hover:bg-accent/30">
                    {/* Main row */}
                    <div className="flex items-start gap-3 p-4">
                      {/* Platform badge */}
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${meta?.color || ''} ${meta?.bgColor || 'bg-muted'}`}>
                        {meta?.icon || '?'}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <NotifIcon className={`h-4 w-4 shrink-0 ${notifMeta.color}`} />
                          <p className="text-sm font-medium">{notif.message}</p>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{notif.username}</span>
                          <span>·</span>
                          <span>{timeAgo(notif.createdAt)}</span>
                          {notif.count > 1 && (
                            <>
                              <span>·</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {notif.count.toLocaleString()}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1">
                        {notif.publishedUrl && (
                          <a
                            href={notif.publishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                            title="View on platform"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {notif.details && notif.details.length > 0 && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : notif.id)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && notif.details && (
                      <div className="border-t border-border/30 px-4 pb-4 pt-3">
                        <div className="space-y-3">
                          {notif.details.map((detail: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 rounded-lg bg-accent/30 p-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {detail.author?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{detail.author}</span>
                                  <span className="text-xs text-muted-foreground">{timeAgo(detail.createdAt)}</span>
                                </div>
                                <p className="mt-0.5 text-sm text-muted-foreground">{detail.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Quick reply */}
                        {(notif.type === 'comment' || notif.type === 'mention') && (
                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              placeholder="Write a quick reply..."
                              className="flex-1 rounded-lg border border-border/40 bg-accent/30 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-accent/60"
                              value={replyText[notif.id] || ''}
                              onChange={(e) => setReplyText((prev) => ({ ...prev, [notif.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && handleReply(notif.id, notif.publishedUrl)}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleReply(notif.id, notif.publishedUrl)}
                              disabled={!replyText[notif.id]?.trim()}
                            >
                              Reply
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
