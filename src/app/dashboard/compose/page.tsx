'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useComposeStore } from '@/store/compose';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Wand2, Shield, Send, Clock, Image, Film, X, ChevronDown, Search,
  AlertCircle, Link2, Globe, Hash, MapPin, MessageSquare, Type,
  FileText, Info,
} from 'lucide-react';

/* ── Platform metadata ── */
const PLATFORM_META: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  reddit:    { label: 'Reddit',    icon: 'R', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/40' },
  twitter:   { label: 'X / Twitter', icon: 'X', color: 'text-gray-800 dark:text-gray-200', bgColor: 'bg-gray-100 dark:bg-gray-800/40' },
  instagram: { label: 'Instagram', icon: 'I', color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-100 dark:bg-pink-900/40' },
  tiktok:    { label: 'TikTok',    icon: 'T', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-900/40' },
  linkedin:  { label: 'LinkedIn',  icon: 'L', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/40' },
};

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  reddit: 40000,
};

type PlatformMode = 'none' | 'all' | 'reddit' | 'twitter' | 'instagram' | 'tiktok' | 'linkedin';

function PlatformBadge({ platform }: { platform: string }) {
  const meta = PLATFORM_META[platform];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.color} ${meta.bgColor}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

export default function ComposePage() {
  const {
    content, targets, scheduledAt, mediaFiles,
    setContent, addTarget, removeTarget, setScheduledAt,
    addMedia, removeMedia, reset,
  } = useComposeStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aiTopic, setAiTopic] = useState('');
  const [subredditCheck, setSubredditCheck] = useState<any>(null);
  const [platformMode, setPlatformMode] = useState<PlatformMode>('none');
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const [subredditQuery, setSubredditQuery] = useState('');
  const [subredditDropdownOpen, setSubredditDropdownOpen] = useState(false);
  const [redGifsUrl, setRedGifsUrl] = useState('');

  /* Reddit-allowed media/gif domains (r/funnyvideos whitelist + common Reddit domains) */
  const REDDIT_MEDIA_DOMAINS = [
    'redgifs.com', 'i.redgifs.com',
    'imgur.com', 'i.imgur.com',
    'gfycat.com', 'thumbs.gfycat.com',
    'giphy.com', 'media.giphy.com', 'i.giphy.com',
    'tenor.com', 'media.tenor.com', 'c.tenor.com',
    'streamable.com',
    'catbox.moe', 'files.catbox.moe',
    'i.redd.it', 'v.redd.it', 'preview.redd.it',
    'youtube.com', 'youtu.be', 'www.youtube.com',
    'clips.twitch.tv',
    'medal.tv',
    'streamja.com',
    'streamwo.com',
    'streamff.com',
    'dubz.co',
    'clippituser.tv',
  ];
  const [subredditRules, setSubredditRules] = useState<any[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [hashtags, setHashtags] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subredditRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);

  // Subreddit search
  const { data: subredditResults } = useQuery({
    queryKey: ['subreddit-search', subredditQuery],
    queryFn: async () => {
      if (subredditQuery.length < 2) return { subreddits: [] };
      const res = await fetch(`/api/reddit/subreddits?q=${encodeURIComponent(subredditQuery)}`);
      return res.json();
    },
    enabled: subredditQuery.length >= 2,
  });

  const fetchRules = useCallback(async (sub: string) => {
    if (!sub) { setSubredditRules([]); return; }
    setRulesLoading(true);
    try {
      const res = await fetch(`/api/reddit/rules?subreddit=${encodeURIComponent(sub)}`);
      const data = await res.json();
      setSubredditRules(data.rules || []);
    } catch {
      setSubredditRules([]);
    }
    setRulesLoading(false);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (subredditRef.current && !subredditRef.current.contains(e.target as Node)) setSubredditDropdownOpen(false);
      if (platformRef.current && !platformRef.current.contains(e.target as Node)) setPlatformDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const createPost = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { ...content, mediaUrls: mediaFiles.map((m) => m.url) },
          targets,
          scheduledAt: scheduledAt || undefined,
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to create post'); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: scheduledAt ? 'Post scheduled!' : 'Post created as draft' });
      reset();
      setPlatformMode('none');
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const generateCaption = useMutation({
    mutationFn: async () => {
      const platform = activePlatforms[0] || 'twitter';
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, platform }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to generate caption'); }
      return res.json();
    },
    onSuccess: (data) => { setContent({ text: data.caption }); toast({ title: 'Caption generated!' }); },
    onError: (err: Error) => { toast({ title: 'AI Error', description: err.message, variant: 'destructive' }); },
  });

  const checkRedditRules = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/reddit/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subreddit: content.subreddit, title: content.title || '',
          content: content.text, postType: content.link ? 'link' : 'text',
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Analysis failed'); }
      return res.json();
    },
    onSuccess: (data) => setSubredditCheck(data),
    onError: (err: Error) => { toast({ title: 'Rule Check Failed', description: err.message, variant: 'destructive' }); },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      addMedia({ url, type: file.type.startsWith('video/') ? 'video' : 'image', name: file.name });
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddRedGif = () => {
    const trimmed = redGifsUrl.trim();
    if (!trimmed) return;
    try {
      const hostname = new URL(trimmed).hostname.replace(/^www\./, '');
      const allowed = REDDIT_MEDIA_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
      if (allowed) {
        const isVideo = /\.(mp4|webm|mov|gifv)$/i.test(trimmed) || ['streamable.com', 'youtube.com', 'youtu.be', 'clips.twitch.tv', 'medal.tv', 'v.redd.it'].some(d => hostname.includes(d));
        addMedia({ url: trimmed, type: isVideo ? 'video' : 'gif', name: hostname });
        setRedGifsUrl('');
      } else {
        toast({ title: 'Unsupported domain', description: `Allowed: RedGifs, Imgur, Gfycat, Giphy, Tenor, Streamable, Catbox, Reddit media, YouTube, Twitch clips, and more.`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid URL.', variant: 'destructive' });
    }
  };

  const selectSubreddit = (name: string) => {
    setContent({ subreddit: name });
    setSubredditQuery(name);
    setSubredditDropdownOpen(false);
    fetchRules(name);
  };

  /* Derived state */
  const activePlatforms: string[] =
    platformMode === 'none' ? [] :
    platformMode === 'all' ? ['reddit', 'twitter', 'instagram', 'tiktok', 'linkedin'] :
    [platformMode];

  const showReddit    = activePlatforms.includes('reddit');
  const showTwitter   = activePlatforms.includes('twitter');
  const showInstagram = activePlatforms.includes('instagram');
  const showTiktok    = activePlatforms.includes('tiktok');
  const showLinkedin  = activePlatforms.includes('linkedin');

  const charCount = (content.text || '').length;

  const platformOptions: { value: PlatformMode; label: string; desc: string }[] = [
    { value: 'all',       label: 'All Platforms',  desc: 'Post everywhere — shows all required fields for each platform' },
    { value: 'reddit',    label: 'Reddit',         desc: 'Title, subreddit, flair, and community rules' },
    { value: 'twitter',   label: 'X / Twitter',    desc: 'Short text posts up to 280 characters' },
    { value: 'instagram', label: 'Instagram',      desc: 'Photo/video posts with captions and hashtags' },
    { value: 'tiktok',    label: 'TikTok',         desc: 'Video posts with description and hashtags' },
    { value: 'linkedin',  label: 'LinkedIn',       desc: 'Professional posts up to 3,000 characters' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compose Post</h1>
        <p className="text-muted-foreground">Create and schedule posts across your connected platforms</p>
      </div>

      {/* ── Platform Selector ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Publish To
          </CardTitle>
          <CardDescription>
            Choose where to publish. Select a single platform for a tailored experience, or &ldquo;All Platforms&rdquo; to see every field with labels showing which platform requires it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={platformRef} className="relative">
            <button
              type="button"
              onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
              className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-2 text-sm shadow-sm transition-colors hover:bg-accent/50"
            >
              <span className={platformMode !== 'none' ? 'font-medium' : 'text-muted-foreground'}>
                {platformMode === 'none'
                  ? 'Select platforms…'
                  : platformMode === 'all'
                  ? 'All Platforms'
                  : PLATFORM_META[platformMode]?.label || platformMode}
              </span>
              <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${platformDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {platformDropdownOpen && (
              <div className="absolute z-[100] mt-1 w-full rounded-lg border bg-popover shadow-xl">
                <div className="max-h-80 overflow-auto p-1">
                  {platformOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${platformMode === opt.value ? 'bg-accent' : ''}`}
                      onClick={() => { setPlatformMode(opt.value); setPlatformDropdownOpen(false); }}
                    >
                      {opt.value !== 'all' && PLATFORM_META[opt.value] ? (
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${PLATFORM_META[opt.value].color} ${PLATFORM_META[opt.value].bgColor}`}>
                          {PLATFORM_META[opt.value].icon}
                        </div>
                      ) : (
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">★</div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                      {platformMode === opt.value && <span className="mt-1 text-primary">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {platformMode !== 'none' && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activePlatforms.map((p) => <PlatformBadge key={p} platform={p} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Welcome / How-To (shown when no platform chosen) ── */}
      {platformMode === 'none' && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Info className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">How to use Compose</h2>
            <p className="mx-auto mb-6 max-w-lg text-sm text-muted-foreground">
              Select a platform above to get started. Each platform has unique requirements &mdash;
              choosing one shows only the fields you need. Pick <strong>&ldquo;All Platforms&rdquo;</strong> to
              create a single post that goes everywhere, with labels indicating which platform each field is for.
            </p>
            <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4 text-left">
                <p className="mb-1 text-sm font-medium">1. Choose platform</p>
                <p className="text-xs text-muted-foreground">Pick one platform or &ldquo;All Platforms&rdquo;</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-left">
                <p className="mb-1 text-sm font-medium">2. Fill in fields</p>
                <p className="text-xs text-muted-foreground">Each field shows which platform needs it</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-left">
                <p className="mb-1 text-sm font-medium">3. Publish or schedule</p>
                <p className="text-xs text-muted-foreground">Post now, save as draft, or pick a date</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Editor + Sidebar (only shown when platform selected) ── */}
      {platformMode !== 'none' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Editor */}
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Post Content
                </CardTitle>
                <CardDescription>
                  {platformMode === 'all'
                    ? 'Fields are labeled with the platform(s) that require them. Shared fields apply to all.'
                    : `Showing fields for ${PLATFORM_META[platformMode]?.label}. Fill in what\'s needed and hit publish.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* ── Title (Reddit) ── */}
                {showReddit && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Label htmlFor="title" className="flex items-center gap-1.5">
                        <Type className="h-3.5 w-3.5" /> Title
                      </Label>
                      <PlatformBadge platform="reddit" />
                      <span className="text-xs text-destructive">*required</span>
                    </div>
                    <Input
                      id="title"
                      placeholder="Post title (required for Reddit)…"
                      value={content.title || ''}
                      onChange={(e) => setContent({ title: e.target.value })}
                      maxLength={300}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{(content.title || '').length}/300</p>
                  </div>
                )}

                {/* ── Text / Caption (all platforms) ── */}
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Label htmlFor="content" className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {showInstagram || showTiktok ? 'Caption / Text' : 'Text'}
                    </Label>
                    {platformMode === 'all' ? (
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">All platforms</span>
                    ) : (
                      <PlatformBadge platform={platformMode} />
                    )}
                  </div>
                  <Textarea
                    id="content"
                    placeholder={
                      showTwitter && !showInstagram
                        ? 'What\'s happening? (max 280 chars)…'
                        : showInstagram
                        ? 'Write a caption…'
                        : 'What\'s on your mind?'
                    }
                    className="min-h-[140px]"
                    value={content.text || ''}
                    onChange={(e) => setContent({ text: e.target.value })}
                  />
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{charCount} characters</span>
                    {activePlatforms.map((p) => {
                      const limit = PLATFORM_LIMITS[p];
                      if (!limit) return null;
                      const over = charCount > limit;
                      return (
                        <span key={p} className={over ? 'font-medium text-destructive' : ''}>
                          {PLATFORM_META[p]?.label}: {charCount}/{limit}{over ? ' ⚠' : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* ── Link (Twitter, Reddit, LinkedIn) ── */}
                {(showReddit || showTwitter || showLinkedin) && (
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Label htmlFor="link" className="flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5" /> Link
                      </Label>
                      {showReddit && <PlatformBadge platform="reddit" />}
                      {showTwitter && <PlatformBadge platform="twitter" />}
                      {showLinkedin && <PlatformBadge platform="linkedin" />}
                      <span className="text-xs text-muted-foreground">optional</span>
                    </div>
                    <Input
                      id="link"
                      placeholder="https://…"
                      value={content.link || ''}
                      onChange={(e) => setContent({ link: e.target.value })}
                    />
                  </div>
                )}

                {/* ── Hashtags (Instagram, TikTok, Twitter, LinkedIn) ── */}
                {(showInstagram || showTiktok || showTwitter || showLinkedin) && (
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Label className="flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Hashtags
                      </Label>
                      {showInstagram && <PlatformBadge platform="instagram" />}
                      {showTiktok && <PlatformBadge platform="tiktok" />}
                      {showTwitter && <PlatformBadge platform="twitter" />}
                      {showLinkedin && <PlatformBadge platform="linkedin" />}
                    </div>
                    <Input
                      placeholder="#socialmedia #marketing #growth"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {showInstagram ? 'Instagram allows up to 30 hashtags. ' : ''}
                      Separate with spaces.
                    </p>
                  </div>
                )}

                {/* ── Subreddit Search (Reddit) ── */}
                {showReddit && (
                  <div ref={subredditRef} className="relative">
                    <div className="mb-1.5 flex items-center gap-2">
                      <Label className="flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5" /> Subreddit
                      </Label>
                      <PlatformBadge platform="reddit" />
                      <span className="text-xs text-destructive">*required</span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search subreddits…"
                        className="pl-9"
                        value={subredditQuery}
                        onChange={(e) => {
                          setSubredditQuery(e.target.value);
                          setSubredditDropdownOpen(true);
                          if (e.target.value !== content.subreddit) setContent({ subreddit: e.target.value });
                        }}
                        onFocus={() => setSubredditDropdownOpen(true)}
                      />
                      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    {subredditDropdownOpen && subredditResults?.subreddits?.length > 0 && (
                      <div className="absolute z-[100] mt-1 w-full rounded-lg border bg-popover shadow-xl">
                        <div className="max-h-60 overflow-auto p-1">
                          {subredditResults.subreddits.map((sub: any) => (
                            <button
                              key={sub.name}
                              type="button"
                              className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                              onClick={() => selectSubreddit(sub.name)}
                            >
                              <div className="flex-1">
                                <span className="font-medium">r/{sub.name}</span>
                                <p className="text-xs text-muted-foreground">
                                  {sub.subscribers?.toLocaleString()} members
                                  {sub.description ? ` — ${sub.description}` : ''}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Reddit Flair (Reddit) ── */}
                {showReddit && content.subreddit && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Label htmlFor="flair">Flair</Label>
                      <PlatformBadge platform="reddit" />
                      <span className="text-xs text-muted-foreground">optional</span>
                    </div>
                    <Input
                      id="flair"
                      placeholder="Post flair…"
                      value={content.flair || ''}
                      onChange={(e) => setContent({ flair: e.target.value })}
                    />
                  </div>
                )}

                {/* ── Subreddit Rules ── */}
                {showReddit && content.subreddit && subredditRules.length > 0 && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                      <AlertCircle className="h-4 w-4" />
                      r/{content.subreddit} Rules
                    </div>
                    <ol className="space-y-1.5">
                      {subredditRules.map((rule, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{i + 1}. {rule.title}</span>
                          {rule.description && <p className="ml-4 text-xs text-muted-foreground">{rule.description}</p>}
                        </li>
                      ))}
                    </ol>
                    {rulesLoading && <p className="mt-2 text-xs text-muted-foreground">Loading rules…</p>}
                  </div>
                )}

                {/* ── Media Upload ── */}
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Label className="flex items-center gap-1.5">
                      <Image className="h-3.5 w-3.5" /> Media
                    </Label>
                    {showInstagram && <PlatformBadge platform="instagram" />}
                    {showTiktok && <PlatformBadge platform="tiktok" />}
                    {(showReddit || showTwitter || showLinkedin) && platformMode === 'all' && (
                      <span className="text-xs text-muted-foreground">optional for others</span>
                    )}
                    {(showInstagram || showTiktok) && (
                      <span className="text-xs text-destructive">
                        *required for {showInstagram && showTiktok ? 'Instagram & TikTok' : showInstagram ? 'Instagram' : 'TikTok'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Image className="mr-2 h-4 w-4" />
                        {showTiktok && !showInstagram ? 'Add Video' : 'Add Image / Video'}
                      </Button>
                      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileUpload} />
                    </div>

                    {showTiktok && (
                      <p className="text-xs text-muted-foreground">
                        TikTok requires a video file. Supported: MP4, WebM (up to 10 min).
                      </p>
                    )}
                    {showInstagram && (
                      <p className="text-xs text-muted-foreground">
                        Instagram supports single image, carousel (up to 10), or video (up to 60s for feed).
                      </p>
                    )}

                    {/* RedGif link input (Reddit) */}
                    {showReddit && (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input placeholder="Paste media URL (RedGifs, Imgur, Gfycat, Giphy, Streamable…)" className="pl-9" value={redGifsUrl} onChange={(e) => setRedGifsUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddRedGif()} />
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddRedGif} disabled={!redGifsUrl.trim()}>
                          <Film className="mr-1 h-4 w-4" /> Add Link
                        </Button>
                      </div>
                    )}

                    {mediaFiles.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {mediaFiles.map((media) => (
                          <div key={media.url} className="group relative overflow-hidden rounded-md border">
                            {media.type === 'video' ? (
                              <video src={media.url} className="h-24 w-full object-cover" />
                            ) : media.type === 'gif' ? (
                              <div className="flex h-24 items-center justify-center bg-muted text-xs text-muted-foreground">
                                <Film className="mr-1 h-4 w-4" /> RedGifs
                              </div>
                            ) : (
                              <img src={media.url} alt="" className="h-24 w-full object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => removeMedia(media.url)}
                              className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <p className="truncate px-1 py-0.5 text-xs text-muted-foreground">{media.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── AI Caption Generator ── */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Wand2 className="h-4 w-4 text-purple-500" /> AI Caption Generator
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Describe your topic…" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
                    <Button onClick={() => generateCaption.mutate()} disabled={!aiTopic || generateCaption.isPending} size="sm">
                      {generateCaption.isPending ? 'Generating…' : 'Generate'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reddit Rule Compliance (AI) */}
            {showReddit && content.subreddit && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-500" />
                    Reddit Rule Compliance
                  </CardTitle>
                  <CardDescription>AI-powered check for r/{content.subreddit} rules</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => checkRedditRules.mutate()} disabled={checkRedditRules.isPending} variant="outline" className="mb-4">
                    {checkRedditRules.isPending ? 'Analyzing…' : 'Check Compliance'}
                  </Button>

                  {subredditCheck && (
                    <div className="space-y-3">
                      <Badge variant={subredditCheck.allowed ? 'default' : 'destructive'}>
                        {subredditCheck.allowed ? '✓ Compliant' : '✗ Violations Found'}
                      </Badge>
                      {subredditCheck.violations?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-destructive">Violations:</p>
                          <ul className="list-inside list-disc text-sm">{subredditCheck.violations.map((v: string, i: number) => <li key={i}>{v}</li>)}</ul>
                        </div>
                      )}
                      {subredditCheck.suggestions?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Suggestions:</p>
                          <ul className="list-inside list-disc text-sm text-muted-foreground">{subredditCheck.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                        </div>
                      )}
                      {subredditCheck.recommended_flair && (
                        <p className="text-sm">Recommended flair: <Badge variant="secondary">{subredditCheck.recommended_flair}</Badge></p>
                      )}
                      {subredditCheck.best_time_to_post && (
                        <p className="text-sm text-muted-foreground">Best time to post: {subredditCheck.best_time_to_post}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right Sidebar: Schedule + Submit ── */}
          <div className="space-y-4">
            {/* Platform requirements summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Platform Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {showTwitter && (
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2">
                    <PlatformBadge platform="twitter" />
                    <span className="text-muted-foreground">Max 280 chars · 4 images or 1 video · Links auto-shorten</span>
                  </div>
                )}
                {showInstagram && (
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2">
                    <PlatformBadge platform="instagram" />
                    <span className="text-muted-foreground">Media required · Max 2,200 chars · Up to 30 hashtags</span>
                  </div>
                )}
                {showTiktok && (
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2">
                    <PlatformBadge platform="tiktok" />
                    <span className="text-muted-foreground">Video required · Max 2,200 chars · Hashtags recommended</span>
                  </div>
                )}
                {showReddit && (
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2">
                    <PlatformBadge platform="reddit" />
                    <span className="text-muted-foreground">Title & subreddit required · Check rules before posting</span>
                  </div>
                )}
                {showLinkedin && (
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2">
                    <PlatformBadge platform="linkedin" />
                    <span className="text-muted-foreground">Max 3,000 chars · Professional tone recommended</span>
                  </div>
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
                <p className="text-xs text-muted-foreground">Leave empty to save as draft</p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => createPost.mutate()} disabled={createPost.isPending}>
                <Send className="mr-2 h-4 w-4" />
                {createPost.isPending ? 'Creating…' : scheduledAt ? 'Schedule Post' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
