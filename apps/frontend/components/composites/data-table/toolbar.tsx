'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/tokens/cn';
import type { FilterChip } from './types';

type DataTableToolbarProps = {
  toolbar: {
    search?: { value: string; onChange: (v: string) => void; placeholder?: string };
    filters?: FilterChip[];
    actions?: React.ReactNode;
  };
};

export function DataTableToolbar({ toolbar }: DataTableToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap flex-1">
      {toolbar.search && (
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={toolbar.search.value}
            onChange={(e) => toolbar.search?.onChange(e.target.value)}
            placeholder={toolbar.search.placeholder ?? 'Search…'}
            className="pl-9"
            aria-label="Search"
          />
        </div>
      )}
      {toolbar.filters && toolbar.filters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {toolbar.filters.map((chip) => (
            <button
              key={chip.id}
              onClick={chip.onToggle}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                chip.active
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-2 text-muted-foreground hover:bg-surface-3'
              )}
              aria-pressed={chip.active}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
      {toolbar.actions && <div className="ml-auto">{toolbar.actions}</div>}
    </div>
  );
}
