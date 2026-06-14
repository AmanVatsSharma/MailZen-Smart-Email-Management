'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/primitives/spinner';
import { cn } from '@/lib/tokens/cn';

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
  disabled?: boolean;
};

export type CommandGroup = {
  id: string;
  label: string;
  items: CommandItem[];
};

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroup[];
  hotkey?: string;
  emptyState?: { title: string; hint?: string };
  asyncSearch?: {
    query: string;
    onQuery: (q: string) => Promise<CommandItem[]>;
    debounceMs?: number;
  };
  placeholder?: string;
};

function scoreMatch(item: CommandItem, query: string): number {
  if (!query) return 1; // show all when empty
  const q = query.toLowerCase();
  const hay = [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase();
  if (hay.includes(q)) return 2; // direct match
  if (item.label.toLowerCase().startsWith(q)) return 3; // prefix
  return 0; // no match
}

export function CommandPalette({
  open,
  onOpenChange,
  groups,
  hotkey = 'mod+k',
  emptyState,
  asyncSearch,
  placeholder = 'Type a command or search…',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [asyncResults, setAsyncResults] = useState<CommandItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Hotkey
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange, hotkey]);

  // Async search with debounce
  useEffect(() => {
    if (!asyncSearch || !open) return;
    const debounceMs = asyncSearch.debounceMs ?? 200;
    const timer = setTimeout(async () => {
      if (!query) {
        setAsyncResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const results = await asyncSearch.onQuery(query);
        setAsyncResults(results);
      } catch {
        setAsyncResults([]);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, asyncSearch, open]);

  // Filter local items
  const filteredGroups = useMemo(() => {
    if (asyncSearch) return groups; // async results are shown separately
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => scoreMatch(it, query) > 0),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query, asyncSearch]);

  // Flatten visible items for keyboard navigation
  const flatItems = useMemo(() => {
    if (asyncSearch) {
      return asyncResults.map((it) => ({ item: it, groupId: '__async__' }));
    }
    return filteredGroups.flatMap((g) =>
      g.items.map((it) => ({ item: it, groupId: g.id }))
    );
  }, [filteredGroups, asyncResults, asyncSearch]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [flatItems.length, query]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.disabled) return;
      item.onSelect();
      onOpenChange(false);
      setQuery('');
    },
    [onOpenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = flatItems[activeIndex];
        if (target) handleSelect(target.item);
      }
    },
    [flatItems, activeIndex, handleSelect]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl p-0 gap-0 overflow-hidden"
        aria-describedby="command-palette-desc"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription id="command-palette-desc" className="sr-only">
          Search and run commands across MailZen.
        </DialogDescription>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="border-0 focus-visible:ring-0 px-0"
            autoFocus
            aria-label="Command search"
          />
          {isSearching && <Spinner size="sm" className="ml-2" />}
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p className="font-medium">{emptyState?.title ?? 'No commands found'}</p>
              {emptyState?.hint && <p className="mt-1 text-xs">{emptyState.hint}</p>}
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="mb-2">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const flatIndex = flatItems.findIndex((f) => f.item.id === item.id);
                  const isActive = flatIndex === activeIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      disabled={item.disabled}
                      className={cn(
                        'w-full flex items-center gap-3 px-2 py-2 rounded text-left text-sm',
                        isActive && 'bg-brand-50 text-brand-900',
                        item.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {item.icon && (
                        <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">
                          {item.icon}
                        </span>
                      )}
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="text-[10px] text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
