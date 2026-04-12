'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';

type ThemeOption = 'light' | 'dark' | 'system';

const options: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const active = theme ?? 'system';
  const isDark = resolvedTheme === 'dark';

  if (!mounted) {
    return (
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        aria-label="Theme"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Sun
          className={cn(
            'h-4 w-4 transition-all',
            isDark ? 'scale-0 opacity-0' : 'scale-100 opacity-100',
          )}
        />
        <Moon
          className={cn(
            'absolute h-4 w-4 transition-all',
            isDark ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Theme"
          className="absolute right-0 top-full z-[60] mt-1.5 min-w-[9.5rem] overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-xl"
        >
          {options.map(({ value, label, icon: Icon }) => (
            <li key={value} role="option" aria-selected={active === value}>
              <button
                type="button"
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  active === value
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
