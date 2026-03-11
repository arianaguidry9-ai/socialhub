'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Megaphone, DollarSign, TrendingUp, MousePointer, Eye,
  Search, Filter, ExternalLink, Plus, Send, Users,
  BarChart3, CheckCircle, Clock, XCircle, Pause,
} from 'lucide-react';

const PLATFORM_META: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  reddit:    { label: 'Reddit',     icon: 'R', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/40' },
  twitter:   { label: 'X / Twitter', icon: 'X', color: 'text-gray-800 dark:text-gray-200',   bgColor: 'bg-gray-100 dark:bg-gray-800/40' },
  instagram: { label: 'Instagram',  icon: 'I', color: 'text-pink-600 dark:text-pink-400',     bgColor: 'bg-pink-100 dark:bg-pink-900/40' },
  tiktok:    { label: 'TikTok',     icon: 'T', color: 'text-cyan-600 dark:text-cyan-400',     bgColor: 'bg-cyan-100 dark:bg-cyan-900/40' },
  linkedin:  { label: 'LinkedIn',   icon: 'L', color: 'text-blue-600 dark:text-blue-400',     bgColor: 'bg-blue-100 dark:bg-blue-900/40' },
  youtube:   { label: 'YouTube',    icon: 'Y', color: 'text-red-600 dark:text-red-400',       bgColor: 'bg-red-100 dark:bg-red-900/40' },
};

const CONTENT_TYPES = [
  { label: 'All Types', value: 'all' },
  { label: 'Tech', value: 'tech' },
  { label: 'Fitness', value: 'fitness' },
  { label: 'Food', value: 'food' },
  { label: 'Business', value: 'business' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'Design', value: 'design' },
  { label: 'Travel', value: 'travel' },
];

const PLATFORM_FILTER = [
  { label: 'All Platforms', value: 'all' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'X / Twitter', value: 'twitter' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Reddit', value: 'reddit' },
];

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  ACTIVE:    { icon: CheckCircle, color: 'text-green-500', label: 'Active' },
  PAUSED:    { icon: Pause,       color: 'text-amber-500', label: 'Paused' },
  COMPLETED: { icon: CheckCircle, color: 'text-blue-500',  label: 'Completed' },
  DRAFT:     { icon: Clock,       color: 'text-gray-500',  label: 'Draft' },
  PENDING:   { icon: Clock,       color: 'text-amber-500', label: 'Pending' },
  ACCEPTED:  { icon: CheckCircle, color: 'text-green-500', label: 'Accepted' },
  DECLINED:  { icon: XCircle,     color: 'text-red-500',   label: 'Declined' },
};

export default function PromotionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('campaigns');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [creatorSearch, setCreatorSearch] = useState('');
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showSubmitRequest, setShowSubmitRequest] = useState(false);

  // New campaign form
  const [newCampaign, setNewCampaign] = useState({
    name: '', platform: 'twitter', budget: '', startDate: '', endDate: '',
  });
  // New request form
  const [newRequest, setNewRequest] = useState({
    platform: 'twitter', contentDesc: '', budget: '',
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['promotions', 'campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/promotions?tab=campaigns');
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: activeTab === 'campaigns',
  });

  const { data: creatorsData, isLoading: creatorsLoading } = useQuery({
    queryKey: ['promotions', 'creators', contentTypeFilter, platformFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ tab: 'creators' });
      if (contentTypeFilter !== 'all') params.set('contentType', contentTypeFilter);
      if (platformFilter !== 'all') params.set('platform', platformFilter);
      const res = await fetch(`/api/promotions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch creators');
      return res.json();
    },
    enabled: activeTab === 'creators',
  });

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['promotions', 'requests'],
    queryFn: async () => {
      const res = await fetch('/api/promotions?tab=requests');
      if (!res.ok) throw new Error('Failed to fetch requests');
      return res.json();
    },
    enabled: activeTab === 'requests',
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-campaign', campaign: newCampaign }),
      });
      if (!res.ok) throw new Error('Failed to create campaign');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Campaign created!' });
      setShowNewCampaign(false);
      setNewCampaign({ name: '', platform: 'twitter', budget: '', startDate: '', endDate: '' });
      queryClient.invalidateQueries({ queryKey: ['promotions', 'campaigns'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const contactCreator = useMutation({
    mutationFn: async (creatorId: string) => {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'contact-creator', creatorId }),
      });
      if (!res.ok) throw new Error('Failed to contact creator');
      return res.json();
    },
    onSuccess: () => toast({ title: 'Request sent to creator!' }),
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const submitRequest = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit-request', request: newRequest }),
      });
      if (!res.ok) throw new Error('Failed to submit request');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Promotion request submitted!' });
      setShowSubmitRequest(false);
      setNewRequest({ platform: 'twitter', contentDesc: '', budget: '' });
      queryClient.invalidateQueries({ queryKey: ['promotions', 'requests'] });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const campaigns = campaignsData?.campaigns || [];
  const creators = creatorsData?.creators || [];
  const requests = requestsData?.requests || [];

  // Filter creators by search
  const filteredCreators = creatorSearch
    ? creators.filter((c: any) =>
        c.name.toLowerCase().includes(creatorSearch.toLowerCase()) ||
        c.username.toLowerCase().includes(creatorSearch.toLowerCase()) ||
        c.bio.toLowerCase().includes(creatorSearch.toLowerCase())
      )
    : creators;

  // Aggregate campaign stats
  const totalSpent = campaigns.reduce((sum: number, c: any) => sum + (c.spent || 0), 0);
  const totalImpressions = campaigns.reduce((sum: number, c: any) => sum + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum: number, c: any) => sum + (c.clicks || 0), 0);
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Promotions</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Manage ad campaigns, discover creators for paid promotions, and handle promotion requests
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active Campaigns', value: activeCampaigns, icon: Megaphone, color: 'text-purple-500' },
          { label: 'Total Spent', value: `$${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-green-500' },
          { label: 'Impressions', value: totalImpressions.toLocaleString(), icon: Eye, color: 'text-blue-500' },
          { label: 'Total Clicks', value: totalClicks.toLocaleString(), icon: MousePointer, color: 'text-orange-500' },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{campaignsLoading ? '...' : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">
            <Megaphone className="mr-2 h-4 w-4" /> Ad Campaigns
          </TabsTrigger>
          <TabsTrigger value="creators">
            <Users className="mr-2 h-4 w-4" /> Find Creators
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Send className="mr-2 h-4 w-4" /> Requests
          </TabsTrigger>
        </TabsList>

        {/* ── Ad Campaigns Tab ── */}
        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ad Campaigns</CardTitle>
                  <CardDescription>Manage your advertising campaigns across platforms</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowNewCampaign(!showNewCampaign)}>
                  <Plus className="mr-2 h-4 w-4" /> New Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* New Campaign Form */}
              {showNewCampaign && (
                <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <h3 className="mb-4 text-sm font-semibold">Create New Campaign</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="camp-name">Campaign Name</Label>
                      <Input
                        id="camp-name"
                        placeholder="e.g., Spring Product Launch"
                        value={newCampaign.name}
                        onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Platform</Label>
                      <Select value={newCampaign.platform} onValueChange={(v) => setNewCampaign((p) => ({ ...p, platform: v }))}>
                        {PLATFORM_FILTER.filter((p) => p.value !== 'all').map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="camp-budget">Budget ($)</Label>
                      <Input
                        id="camp-budget"
                        type="number"
                        placeholder="500"
                        value={newCampaign.budget}
                        onChange={(e) => setNewCampaign((p) => ({ ...p, budget: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="camp-start">Start Date</Label>
                        <Input
                          id="camp-start"
                          type="date"
                          value={newCampaign.startDate}
                          onChange={(e) => setNewCampaign((p) => ({ ...p, startDate: e.target.value }))}
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="camp-end">End Date</Label>
                        <Input
                          id="camp-end"
                          type="date"
                          value={newCampaign.endDate}
                          onChange={(e) => setNewCampaign((p) => ({ ...p, endDate: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => createCampaign.mutate()} disabled={!newCampaign.name || !newCampaign.budget || createCampaign.isPending}>
                      {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowNewCampaign(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Campaign List */}
              {campaignsLoading ? (
                <p className="py-8 text-center text-muted-foreground">Loading campaigns...</p>
              ) : campaigns.length === 0 ? (
                <div className="py-12 text-center">
                  <Megaphone className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No campaigns yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first ad campaign to start promoting</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign: any) => {
                    const statusConf = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
                    const StatusIcon = statusConf.icon;
                    const meta = PLATFORM_META[campaign.platform];
                    const budgetPercent = campaign.budget > 0 ? Math.min(100, (campaign.spent / campaign.budget) * 100) : 0;

                    return (
                      <div key={campaign.id} className="rounded-xl border border-border/40 p-4 transition-colors hover:bg-accent/30">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {meta && (
                              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${meta.color} ${meta.bgColor}`}>
                                {meta.icon}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{campaign.name}</p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <StatusIcon className={`h-3.5 w-3.5 ${statusConf.color}`} />
                                <span>{statusConf.label}</span>
                                <span>·</span>
                                <span>{campaign.startDate} → {campaign.endDate}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {campaign.status}
                          </Badge>
                        </div>
                        {/* Stats row */}
                        <div className="mt-3 grid grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-lg font-semibold">${campaign.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-xs text-muted-foreground">Spent</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold">{campaign.impressions.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Impressions</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold">{campaign.clicks.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Clicks</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold">{campaign.ctr}%</p>
                            <p className="text-xs text-muted-foreground">CTR</p>
                          </div>
                        </div>
                        {/* Budget bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Budget: ${campaign.budget.toLocaleString()}</span>
                            <span>{budgetPercent.toFixed(0)}% used</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-muted">
                            <div
                              className={`h-2 rounded-full transition-all ${budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 70 ? 'bg-amber-500' : 'bg-primary'}`}
                              style={{ width: `${budgetPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Find Creators Tab ── */}
        <TabsContent value="creators">
          <Card>
            <CardHeader>
              <CardTitle>Discover Creators</CardTitle>
              <CardDescription>Find creators filtered by content type and platform for paid promotions</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-6 flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                    <Search className="h-3.5 w-3.5" /> Search
                  </Label>
                  <Input
                    placeholder="Search creators by name, username, or bio..."
                    value={creatorSearch}
                    onChange={(e) => setCreatorSearch(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                    <Filter className="h-3.5 w-3.5" /> Content Type
                  </Label>
                  <Select value={contentTypeFilter} onValueChange={setContentTypeFilter} className="w-[150px]">
                    {CONTENT_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 flex items-center gap-1.5 text-xs">Platform</Label>
                  <Select value={platformFilter} onValueChange={setPlatformFilter} className="w-[150px]">
                    {PLATFORM_FILTER.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Creator Grid */}
              {creatorsLoading ? (
                <p className="py-8 text-center text-muted-foreground">Loading creators...</p>
              ) : filteredCreators.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No creators found</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredCreators.map((creator: any) => (
                    <div key={creator.id} className="rounded-xl border border-border/40 p-5 transition-colors hover:bg-accent/30">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                          {creator.avatarInitial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold">{creator.name}</p>
                            {creator.verified && (
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{creator.username}</p>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{creator.bio}</p>
                        </div>
                      </div>

                      {/* Platforms */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {creator.platforms.map((p: string) => {
                          const pmeta = PLATFORM_META[p];
                          return pmeta ? (
                            <span key={p} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pmeta.color} ${pmeta.bgColor}`}>
                              {pmeta.icon} {pmeta.label}
                            </span>
                          ) : null;
                        })}
                        <Badge variant="secondary" className="text-[10px] capitalize">{creator.contentType}</Badge>
                      </div>

                      {/* Stats */}
                      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <p className="font-semibold">{creator.followers >= 1_000_000 ? `${(creator.followers / 1_000_000).toFixed(1)}M` : `${(creator.followers / 1000).toFixed(0)}K`}</p>
                          <p className="text-muted-foreground">Followers</p>
                        </div>
                        <div>
                          <p className="font-semibold">{creator.engagement}%</p>
                          <p className="text-muted-foreground">Engage</p>
                        </div>
                        <div>
                          <p className="font-semibold">{creator.avgViews >= 1_000_000 ? `${(creator.avgViews / 1_000_000).toFixed(1)}M` : `${(creator.avgViews / 1000).toFixed(0)}K`}</p>
                          <p className="text-muted-foreground">Avg Views</p>
                        </div>
                        <div>
                          <p className="font-semibold text-green-600 dark:text-green-400">{creator.rate}</p>
                          <p className="text-muted-foreground">Rate</p>
                        </div>
                      </div>

                      <Button
                        className="mt-4 w-full"
                        size="sm"
                        variant="outline"
                        onClick={() => contactCreator.mutate(creator.id)}
                        disabled={contactCreator.isPending}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Contact for Promotion
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Promotion Requests Tab ── */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Promotion Requests</CardTitle>
                  <CardDescription>Incoming requests from users who want you to promote their content, or submit your own</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowSubmitRequest(!showSubmitRequest)}>
                  <Plus className="mr-2 h-4 w-4" /> Submit Request
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Submit Request Form */}
              {showSubmitRequest && (
                <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <h3 className="mb-4 text-sm font-semibold">Submit Promotion Request</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Platform</Label>
                      <Select value={newRequest.platform} onValueChange={(v) => setNewRequest((p) => ({ ...p, platform: v }))}>
                        {PLATFORM_FILTER.filter((p) => p.value !== 'all').map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="req-desc">Content Description</Label>
                      <Textarea
                        id="req-desc"
                        placeholder="Describe the content you want promoted..."
                        value={newRequest.contentDesc}
                        onChange={(e) => setNewRequest((p) => ({ ...p, contentDesc: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="req-budget">Budget ($)</Label>
                      <Input
                        id="req-budget"
                        placeholder="e.g., 200"
                        value={newRequest.budget}
                        onChange={(e) => setNewRequest((p) => ({ ...p, budget: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => submitRequest.mutate()} disabled={!newRequest.contentDesc || !newRequest.budget || submitRequest.isPending}>
                      {submitRequest.isPending ? 'Submitting...' : 'Submit Request'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowSubmitRequest(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Requests List */}
              {requestsLoading ? (
                <p className="py-8 text-center text-muted-foreground">Loading requests...</p>
              ) : requests.length === 0 ? (
                <div className="py-12 text-center">
                  <Send className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No promotion requests yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((request: any) => {
                    const statusConf = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING;
                    const StatusIcon = statusConf.icon;
                    const meta = PLATFORM_META[request.platform];

                    return (
                      <div key={request.id} className="flex items-start gap-4 rounded-xl border border-border/40 p-4 transition-colors hover:bg-accent/30">
                        {meta && (
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${meta.color} ${meta.bgColor}`}>
                            {meta.icon}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{request.from}</p>
                            <Badge variant="secondary" className="text-[10px]">{meta?.label || request.platform}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{request.contentDesc}</p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-medium text-green-600 dark:text-green-400">{request.budget}</span>
                            <span>·</span>
                            <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${statusConf.color}`} />
                          <Badge variant={request.status === 'ACCEPTED' ? 'default' : request.status === 'DECLINED' ? 'destructive' : 'secondary'}>
                            {statusConf.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
