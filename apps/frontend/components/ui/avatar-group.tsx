import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type AvatarGroupParticipant = {
  name: string;
  email?: string;
  avatar?: string;
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function deterministicColor(str: string): string {
  const palette = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

interface AvatarGroupProps {
  participants: AvatarGroupParticipant[];
  maxVisible?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function AvatarGroup({
  participants,
  maxVisible = 4,
  size = 'md',
  className,
}: AvatarGroupProps) {
  const visible = participants.slice(0, maxVisible);
  const overflow = participants.length - maxVisible;
  const dim = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-7 w-7 text-[10px]';

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((p, i) => (
        <div
          key={p.email ?? p.name ?? i}
          className={cn(
            'relative rounded-full ring-2 ring-background',
            i > 0 && '-ml-2',
          )}
          style={{ zIndex: visible.length - i }}
          title={p.name}
        >
          <Avatar className={dim}>
            {p.avatar && <AvatarImage src={p.avatar} alt={p.name} />}
            <AvatarFallback
              className={cn('text-white', deterministicColor(p.email ?? p.name))}
            >
              {getInitials(p.name)}
            </AvatarFallback>
          </Avatar>
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'relative -ml-2 flex items-center justify-center rounded-full bg-muted ring-2 ring-background text-muted-foreground font-medium',
            dim,
          )}
          title={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
