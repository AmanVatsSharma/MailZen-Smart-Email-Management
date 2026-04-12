import React from 'react';
import { cn } from '@/lib/utils';

type Priority = 'urgent' | 'high' | 'normal' | 'low';

const PRIORITY_CONFIG: Record<
  Priority,
  { strip: string; label: string; badge: string; dot: string }
> = {
  urgent: {
    strip: 'bg-red-500',
    label: 'Urgent',
    badge: 'bg-red-500/10 text-red-500 border-red-500/20',
    dot: 'bg-red-500',
  },
  high: {
    strip: 'bg-amber-400',
    label: 'High',
    badge: 'bg-amber-400/10 text-amber-500 border-amber-400/20',
    dot: 'bg-amber-400',
  },
  normal: {
    strip: 'bg-blue-400',
    label: 'Normal',
    badge: 'bg-blue-400/10 text-blue-500 border-blue-400/20',
    dot: 'bg-blue-400',
  },
  low: {
    strip: 'bg-muted-foreground/30',
    label: 'Low',
    badge: 'bg-muted/40 text-muted-foreground border-border/40',
    dot: 'bg-muted-foreground/40',
  },
};

interface PriorityStripProps {
  priority: string | null | undefined;
  className?: string;
}

/** 4px left-edge colored strip for email list items */
export function PriorityStrip({ priority, className }: PriorityStripProps) {
  if (!priority) return null;
  const config = PRIORITY_CONFIG[priority as Priority];
  if (!config) return null;

  return (
    <div
      className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-md', config.strip, className)}
      aria-label={`Priority: ${config.label}`}
    />
  );
}

interface PriorityBadgeProps {
  priority: string | null | undefined;
  showLabel?: boolean;
  className?: string;
}

/** Small badge pill with priority label */
export function PriorityBadge({
  priority,
  showLabel = true,
  className,
}: PriorityBadgeProps) {
  if (!priority) return null;
  const config = PRIORITY_CONFIG[priority as Priority];
  if (!config || priority === 'normal') return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide',
        config.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {showLabel && config.label}
    </span>
  );
}

interface CategoryChipProps {
  category: string | null | undefined;
  className?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  work: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400',
  personal: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  newsletter: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
  transaction: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
  social: 'bg-pink-500/10 text-pink-600 border-pink-500/20 dark:text-pink-400',
  notification: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

/** Small category chip */
export function CategoryChip({ category, className }: CategoryChipProps) {
  if (!category || category === 'work') return null;
  const colorClass = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.notification;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium capitalize',
        colorClass,
        className,
      )}
    >
      {category}
    </span>
  );
}
