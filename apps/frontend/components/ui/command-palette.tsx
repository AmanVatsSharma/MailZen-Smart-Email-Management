'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  Bot,
  Command,
  Inbox,
  LayoutDashboard,
  Mail,
  PenSquare,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

type CommandAction = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  shortcut?: string;
  action: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onCompose?: () => void;
  onAiAction?: (action: string) => void;
}

const STORAGE_KEY = 'mailzen_recent_commands';

function getRecentIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function recordRecentId(id: string): void {
  if (typeof window === 'undefined') return;
  const recent = getRecentIds().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, 5)));
}

export function CommandPalette({
  open,
  onClose,
  onCompose,
  onAiAction,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const buildCommands = useCallback((): CommandAction[] => {
    const nav = (path: string) => () => {
      router.push(path);
      onClose();
    };
    return [
      // Navigation
      {
        id: 'go-inbox',
        label: 'Go to Inbox',
        icon: <Inbox className="h-4 w-4" />,
        group: 'Navigate',
        shortcut: 'G I',
        action: nav('/inbox'),
      },
      {
        id: 'go-sent',
        label: 'Go to Sent',
        icon: <Send className="h-4 w-4" />,
        group: 'Navigate',
        shortcut: 'G S',
        action: nav('/sent'),
      },
      {
        id: 'go-archive',
        label: 'Go to Archive',
        icon: <Archive className="h-4 w-4" />,
        group: 'Navigate',
        shortcut: 'G A',
        action: nav('/archive'),
      },
      {
        id: 'go-dashboard',
        label: 'Go to Dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        group: 'Navigate',
        action: nav('/dashboard'),
      },
      {
        id: 'go-settings',
        label: 'Settings',
        icon: <Settings className="h-4 w-4" />,
        group: 'Navigate',
        action: nav('/settings/notifications'),
      },
      // Email Actions
      {
        id: 'compose',
        label: 'Compose new email',
        icon: <PenSquare className="h-4 w-4" />,
        group: 'Email',
        shortcut: 'C',
        action: () => {
          onCompose?.();
          onClose();
        },
      },
      {
        id: 'starred',
        label: 'View starred emails',
        icon: <Star className="h-4 w-4" />,
        group: 'Email',
        action: nav('/inbox?filter=starred'),
      },
      {
        id: 'trash',
        label: 'View trash',
        icon: <Trash2 className="h-4 w-4" />,
        group: 'Email',
        action: nav('/trash'),
      },
      // AI Actions
      {
        id: 'ai-triage',
        label: 'AI: Triage my inbox',
        description: 'Automatically classify and prioritize all emails',
        icon: <Zap className="h-4 w-4 text-primary" />,
        group: 'AI Actions',
        action: () => {
          onAiAction?.('triage_inbox');
          onClose();
        },
      },
      {
        id: 'ai-digest',
        label: 'AI: Generate daily digest',
        description: 'Summarize the most important emails today',
        icon: <Sparkles className="h-4 w-4 text-primary" />,
        group: 'AI Actions',
        action: () => {
          onAiAction?.('daily_digest');
          onClose();
        },
      },
      {
        id: 'ai-followup',
        label: 'AI: Find follow-ups needed',
        description: 'Detect emails awaiting your reply',
        icon: <Bot className="h-4 w-4 text-primary" />,
        group: 'AI Actions',
        action: () => {
          onAiAction?.('detect_followups');
          onClose();
        },
      },
      {
        id: 'ai-unsubscribe',
        label: 'AI: Manage subscriptions',
        description: 'Find newsletters you can unsubscribe from',
        icon: <Mail className="h-4 w-4 text-primary" />,
        group: 'AI Actions',
        action: () => {
          onAiAction?.('manage_subscriptions');
          onClose();
        },
      },
    ];
  }, [router, onClose, onCompose, onAiAction]);

  const commands = buildCommands();

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase()) ||
          c.group.toLowerCase().includes(query.toLowerCase()),
      )
    : (() => {
        const recentIds = getRecentIds();
        const recentCmds = recentIds
          .map((id) => commands.find((c) => c.id === id))
          .filter(Boolean) as CommandAction[];
        const rest = commands.filter(
          (c) => !recentIds.includes(c.id),
        );
        return recentIds.length > 0
          ? [
              ...recentCmds.map((c) => ({ ...c, group: 'Recent' })),
              ...rest,
            ]
          : commands;
      })();

  const grouped = filtered.reduce<Record<string, CommandAction[]>>(
    (acc, cmd) => {
      (acc[cmd.group] ??= []).push(cmd);
      return acc;
    },
    {},
  );

  const flatFiltered = Object.values(grouped).flat();

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const executeSelected = useCallback(() => {
    const cmd = flatFiltered[selectedIndex];
    if (cmd) {
      recordRecentId(cmd.id);
      cmd.action();
    }
  }, [flatFiltered, selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [flatFiltered.length, executeSelected, onClose],
  );

  let flatIndex = 0;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl shadow-black/30"
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands, pages, or ask AI..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center gap-1.5">
                <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  ESC
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-[380px] overflow-y-auto py-2"
            >
              {flatFiltered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No commands found for &ldquo;{query}&rdquo;
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {group}
                    </div>
                    {items.map((cmd) => {
                      const idx = flatIndex++;
                      const isSelected = idx === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            recordRecentId(cmd.id);
                            cmd.action();
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                            isSelected
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                              isSelected
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-border/50 bg-muted/50',
                            )}
                          >
                            {cmd.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground">
                              {cmd.label}
                            </div>
                            {cmd.description && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {cmd.shortcut.split(' ').map((k, i) => (
                                <kbd
                                  key={i}
                                  className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between border-t border-border/50 px-4 py-2">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5">↵</kbd>
                  Select
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Command className="h-2.5 w-2.5" />
                <span>K</span>
              </div>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Hook to wire up the global ⌘K keyboard shortcut */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen, onClose: () => setOpen(false) };
}
