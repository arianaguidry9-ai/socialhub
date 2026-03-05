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
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={selectedLabel ? '' : 'text-muted-foreground'}>
          {selectedLabel || placeholder || 'Select...'}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-[100] mt-1 w-full rounded-lg border bg-popover shadow-xl">
          <div className="max-h-60 overflow-auto p-1">
            {options.map((child) => (
              <button
                key={child.props.value}
                type="button"
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                  child.props.value === value && 'bg-accent text-accent-foreground'
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
