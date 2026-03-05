import { create } from 'zustand';
import type { Platform, PostContent, PostStatus } from '@/types';

interface ComposeState {
  content: PostContent;
  targets: Array<{ socialAccountId: string; platform: Platform; subreddit?: string; flair?: string }>;
  scheduledAt: string | null;
  status: PostStatus;
  mediaFiles: Array<{ url: string; type: 'image' | 'video' | 'gif'; name: string }>;
  setContent: (content: Partial<PostContent>) => void;
  addTarget: (target: ComposeState['targets'][number]) => void;
  removeTarget: (socialAccountId: string) => void;
  setScheduledAt: (dt: string | null) => void;
  addMedia: (media: ComposeState['mediaFiles'][number]) => void;
  removeMedia: (url: string) => void;
  reset: () => void;
}

const initialState = {
  content: {} as PostContent,
  targets: [] as ComposeState['targets'],
  scheduledAt: null as string | null,
  status: 'draft' as PostStatus,
  mediaFiles: [] as ComposeState['mediaFiles'],
};

export const useComposeStore = create<ComposeState>((set) => ({
  ...initialState,
  setContent: (content) => set((s) => ({ content: { ...s.content, ...content } })),
  addTarget: (target) => set((s) => ({ targets: [...s.targets, target] })),
  removeTarget: (id) => set((s) => ({ targets: s.targets.filter((t) => t.socialAccountId !== id) })),
  setScheduledAt: (scheduledAt) => set({ scheduledAt }),
  addMedia: (media) => set((s) => ({ mediaFiles: [...s.mediaFiles, media] })),
  removeMedia: (url) => set((s) => ({ mediaFiles: s.mediaFiles.filter((m) => m.url !== url) })),
  reset: () => set(initialState),
}));
