import { create } from 'zustand';
import type { Platform, PostContent, PostStatus } from '@/types';

interface ComposeState {
  content: PostContent;
  targets: Array<{ socialAccountId: string; platform: Platform; subreddit?: string; flair?: string }>;
  scheduledAt: string | null;
  status: PostStatus;
  setContent: (content: Partial<PostContent>) => void;
  addTarget: (target: ComposeState['targets'][number]) => void;
  removeTarget: (socialAccountId: string) => void;
  setScheduledAt: (dt: string | null) => void;
  reset: () => void;
}

const initialState = {
  content: {},
  targets: [],
  scheduledAt: null,
  status: 'draft' as PostStatus,
};

export const useComposeStore = create<ComposeState>((set) => ({
  ...initialState,
  setContent: (content) => set((s) => ({ content: { ...s.content, ...content } })),
  addTarget: (target) => set((s) => ({ targets: [...s.targets, target] })),
  removeTarget: (id) => set((s) => ({ targets: s.targets.filter((t) => t.socialAccountId !== id) })),
  setScheduledAt: (scheduledAt) => set({ scheduledAt }),
  reset: () => set(initialState),
}));
