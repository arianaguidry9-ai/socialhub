import { create } from 'zustand';
import type { UserPlan } from '@/types';

interface AppState {
  sidebarOpen: boolean;
  plan: UserPlan;
  toggleSidebar: () => void;
  setPlan: (plan: UserPlan) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  plan: 'free',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPlan: (plan) => set({ plan }),
}));
