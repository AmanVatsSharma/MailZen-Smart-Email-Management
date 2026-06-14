'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Inbox, PenSquare, Send, Settings, Sparkles, Star, Trash2 } from 'lucide-react';
import { CommandPalette, type CommandGroup } from './command-palette';

/**
 * Usage example: MailZen's primary command palette, opened with Cmd+K.
 * This replaces the old single-file implementation in components/ui/command-palette.tsx.
 */
export function MailZenCommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const groups: CommandGroup[] = [
    {
      id: 'navigation',
      label: 'Navigation',
      items: [
        { id: 'inbox', label: 'Go to inbox', icon: <Inbox className="h-4 w-4" />, onSelect: () => router.push('/dashboard/inbox') },
        { id: 'sent', label: 'Go to sent', icon: <Send className="h-4 w-4" />, onSelect: () => router.push('/dashboard/sent') },
        { id: 'starred', label: 'Go to starred', icon: <Star className="h-4 w-4" />, onSelect: () => router.push('/dashboard/starred') },
        { id: 'trash', label: 'Go to trash', icon: <Trash2 className="h-4 w-4" />, onSelect: () => router.push('/dashboard/trash') },
        { id: 'archive', label: 'Go to archive', icon: <Archive className="h-4 w-4" />, onSelect: () => router.push('/dashboard/archive') },
        { id: 'settings', label: 'Open settings', icon: <Settings className="h-4 w-4" />, onSelect: () => router.push('/settings') },
      ],
    },
    {
      id: 'compose',
      label: 'Compose',
      items: [
        { id: 'compose-email', label: 'Compose new email', icon: <PenSquare className="h-4 w-4" />, shortcut: 'C', onSelect: () => router.push('/compose') },
      ],
    },
    {
      id: 'ai',
      label: 'AI',
      items: [
        { id: 'ai-triage', label: 'Triage inbox with AI', icon: <Sparkles className="h-4 w-4" />, onSelect: () => router.push('/ai/triage') },
        { id: 'ai-summarize', label: 'Summarize thread', icon: <Sparkles className="h-4 w-4" />, onSelect: () => router.push('/ai/summarize') },
      ],
    },
  ];

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      groups={groups}
      hotkey="mod+k"
      emptyState={{ title: 'No commands found', hint: 'Try a different search' }}
    />
  );
}
