'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  placeholder?: string;
}

export function Select({ value, onValueChange, children, className, placeholder }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = React.Children.toArray(children) as React.ReactElement[];
  const selectedLabel = options.find(
    (child) => child.props.value === value
  )?.props.children;

  return (
    <div ref={ref} className={cn('relative inline-block min-w-[140px]', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center justify-between gap-2 whitespace-nowrap rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm shadow-sm backdrop-blur-sm ring-offset-background transition-all hover:bg-accent/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={selectedLabel ? '' : 'text-muted-foreground'}>
          {selectedLabel || placeholder || 'Select...'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-[100] mt-1.5 min-w-full rounded-xl border border-border/60 bg-popover shadow-2xl backdrop-blur-xl">
          <div className="max-h-60 overflow-auto p-1.5">
            {options.map((child) => (
              <button
                key={child.props.value}
                type="button"
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors hover:bg-accent/60',
                  child.props.value === value && 'bg-accent/60 text-accent-foreground'
                )}
                onClick={() => {
                  onValueChange(child.props.value);
                  setOpen(false);
                }}
              >
                {child.props.children}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SelectItem({ children, value: _value }: { children: React.ReactNode; value: string }) {
  return <>{children}</>;
}
