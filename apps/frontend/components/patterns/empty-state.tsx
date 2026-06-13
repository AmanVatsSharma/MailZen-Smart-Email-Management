'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Mail, Search, Lock, Wrench, Sparkles, Inbox } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { cn } from '@/lib/tokens/cn';

type EmptyVariant =
  | 'no-data'
  | 'no-results'
  | 'no-access'
  | 'error'
  | 'coming-soon';

type IllustrationName = 'search' | 'inbox' | 'lock' | 'wrench' | 'sparkles';

const ILLUSTRATIONS: Record<IllustrationName, ReactNode> = {
  search: <Search className="h-6 w-6" />,
  inbox: <Inbox className="h-6 w-6" />,
  lock: <Lock className="h-6 w-6" />,
  wrench: <Wrench className="h-6 w-6" />,
  sparkles: <Sparkles className="h-6 w-6" />,
};

const DEFAULTS: Record<EmptyVariant, { title: string; description: string; illustration: IllustrationName }> = {
  'no-data': {
    title: 'No data yet',
    description: 'Get started by creating your first item.',
    illustration: 'inbox',
  },
  'no-results': {
    title: 'No results found',
    description: 'Try adjusting your search or filters.',
    illustration: 'search',
  },
  'no-access': {
    title: 'Access denied',
    description: "You don't have permission to view this.",
    illustration: 'lock',
  },
  error: {
    title: 'Something went wrong',
    description: 'We encountered an unexpected error.',
    illustration: 'wrench',
  },
  'coming-soon': {
    title: 'Coming soon',
    description: "We're working on this feature.",
    illustration: 'sparkles',
  },
};

type EmptyStateProps = {
  variant: EmptyVariant;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void; variant?: ButtonVariant };
  secondaryAction?: { label: string; onClick: () => void };
  illustration?: IllustrationName;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function EmptyState({
  variant,
  title,
  description,
  icon,
  action,
  secondaryAction,
  illustration,
  size = 'md',
  className,
}: EmptyStateProps) {
  const defaults = DEFAULTS[variant];
  const finalTitle = title ?? defaults.title;
  const finalDescription = description ?? defaults.description;
  const finalIcon = icon ?? ILLUSTRATIONS[illustration ?? defaults.illustration];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed text-center',
        size === 'sm' && 'p-6',
        size === 'md' && 'p-10',
        size === 'lg' && 'p-16',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          size === 'sm' && 'h-10 w-10',
          size === 'md' && 'h-14 w-14',
          size === 'lg' && 'h-20 w-20'
        )}
      >
        {finalIcon}
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h3 className="font-semibold text-base">{finalTitle}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {finalDescription}
        </p>
      </div>
      {(action || secondaryAction) && (
        <div className="flex gap-2">
          {action && (
            <Button
              variant={action.variant ?? 'default'}
              size="sm"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
