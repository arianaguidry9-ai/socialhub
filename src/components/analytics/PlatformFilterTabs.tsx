'use client';

import { cn } from '@/lib/utils';

const PLATFORMS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
] as const;

interface PlatformFilterTabsProps {
  selected: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PlatformFilterTabs({ selected, onChange, className }: PlatformFilterTabsProps) {
  return (
    <div className={cn('inline-flex flex-wrap items-center gap-1 rounded-lg border bg-muted/50 p-1', className)}>
      {PLATFORMS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-all',
            selected === p.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function PlatformEmptyState({ platform }: { platform: string }) {
  const label = PLATFORMS.find((p) => p.value === platform)?.label ?? platform;
  return (
    <p className="py-12 text-center text-muted-foreground">
      No data yet for {label}. Start posting to see analytics here.
    </p>
  );
}
