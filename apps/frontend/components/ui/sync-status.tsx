'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, AlertTriangle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/tokens/cn';

export type SyncState = 'syncing' | 'idle' | 'degraded' | 'offline';

interface SyncStatusProps {
  /** Current sync state — drives icon and color */
  state?: SyncState;
  /** Last synced ISO timestamp (shown in tooltip) */
  lastSyncedAt?: string | null;
  className?: string;
}

const STATE_CONFIG: Record<
  SyncState,
  { label: string; color: string; pulse: string }
> = {
  syncing: {
    label: 'Syncing…',
    color: 'text-blue-500',
    pulse: 'bg-blue-500',
  },
  idle: {
    label: 'AI Active',
    color: 'text-emerald-500',
    pulse: 'bg-emerald-500',
  },
  degraded: {
    label: 'Sync degraded',
    color: 'text-amber-500',
    pulse: 'bg-amber-400',
  },
  offline: {
    label: 'Sync offline',
    color: 'text-destructive',
    pulse: 'bg-destructive',
  },
};

export function SyncStatus({
  state = 'idle',
  lastSyncedAt,
  className,
}: SyncStatusProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const config = STATE_CONFIG[state];

  const lastSyncLabel = lastSyncedAt
    ? `Last sync: ${new Date(lastSyncedAt).toLocaleTimeString()}`
    : null;

  return (
    <div
      className={cn('relative flex items-center', className)}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      {/* Icon area */}
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.color)}>
        {state === 'syncing' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === 'degraded' ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : state === 'offline' ? (
          <WifiOff className="h-3.5 w-3.5" />
        ) : (
          /* idle: pulsing dot */
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping',
                config.pulse,
              )}
              style={{ animationDuration: '3s' }}
            />
            <span
              className={cn('relative inline-flex h-2 w-2 rounded-full', config.pulse)}
            />
          </span>
        )}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipVisible && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] rounded-lg border border-border/60 bg-popover px-3 py-2 text-[11px] shadow-xl"
          >
            <p className={cn('font-semibold', config.color)}>{config.label}</p>
            {lastSyncLabel && (
              <p className="mt-0.5 text-muted-foreground">{lastSyncLabel}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
