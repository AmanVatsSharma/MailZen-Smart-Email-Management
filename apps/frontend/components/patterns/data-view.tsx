'use client';

import { ReactNode, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/patterns/empty-state';
import { InlineError } from '@/components/primitives/inline-error';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { cn } from '@/lib/tokens/cn';
import type { AsyncState } from '@/lib/types/async-state';

type Layout = 'list' | 'grid' | 'table';

type DataViewProps<T> = {
  state: AsyncState<T>;
  renderItem: (item: T, index: number) => ReactNode;
  renderSkeleton: () => ReactNode;
  keyExtractor: (item: T) => string;
  emptyState?: {
    variant: 'no-data' | 'no-results' | 'no-access' | 'coming-soon';
    title?: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
  errorState?: { title?: string; description?: string };
  layout?: Layout;
  gridClassName?: string;
  skeletonCount?: number;
  className?: string;
  onRetry?: () => void;
  minHeight?: number;
  flashThresholdMs?: number;
};

export function DataView<T>({
  state,
  renderItem,
  renderSkeleton,
  keyExtractor,
  emptyState,
  errorState,
  layout = 'list',
  gridClassName,
  skeletonCount = 6,
  className,
  onRetry,
  minHeight,
  flashThresholdMs = 150,
}: DataViewProps<T>) {
  const reducedMotion = useReducedMotion();
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (state.status === 'loading') {
      const start = Date.now();
      setLoadingStartTime(start);
      const timeout = setTimeout(() => {
        setShowSkeleton(true);
      }, flashThresholdMs);
      return () => {
        clearTimeout(timeout);
        setShowSkeleton(false);
        setLoadingStartTime(null);
      };
    } else {
      setShowSkeleton(false);
      setLoadingStartTime(null);
    }
  }, [state.status, flashThresholdMs]);

  // Don't show skeleton if loading completes within flash threshold
  if (state.status === 'loading' && !showSkeleton) {
    return null;
  }

  // Loading state (after flash threshold)
  if (state.status === 'loading' && showSkeleton) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={minHeight ? { minHeight } : undefined}
        className={className}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i}>{renderSkeleton()}</div>
        ))}
      </div>
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div style={minHeight ? { minHeight } : undefined} className={className}>
        <InlineError
          error={state.error}
          onRetry={onRetry}
          title={errorState?.title}
          description={errorState?.description}
        />
      </div>
    );
  }

  // Empty state
  if (state.status === 'empty' || (state.status === 'success' && state.data.length === 0)) {
    if (!emptyState) return null;
    return (
      <div style={minHeight ? { minHeight } : undefined} className={className}>
        <EmptyState
          variant={emptyState.variant}
          title={emptyState.title}
          description={emptyState.description}
          action={emptyState.action}
        />
      </div>
    );
  }

  // Success state
  if (state.status === 'success') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="data"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          style={minHeight ? { minHeight } : undefined}
          className={cn(
            layout === 'grid' && cn('grid gap-4', gridClassName),
            className
          )}
        >
          {state.data.map((item, index) => (
            <div key={keyExtractor(item)}>
              {renderItem(item, index)}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
