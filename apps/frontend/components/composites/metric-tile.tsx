import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { ProgressRing } from './progress-ring';
import { cn } from '@/lib/tokens/cn';

export type MetricTileProps = {
  /** Short label above the value */
  label: string;
  /** Primary value (e.g. "4.2 GB") */
  value: string;
  /** Optional total (e.g. "15 GB") — shows as "4.2 GB / 15 GB" when provided */
  total?: string;
  /** Progress value 0..1 — when provided, a ProgressRing is shown */
  progress?: number;
  /** Trend indicator */
  trend?: 'up' | 'down' | 'flat';
  /** Optional period label */
  period?: string;
  /** Optional icon shown next to the label */
  icon?: React.ReactNode;
  className?: string;
};

/**
 * MetricTile — denser cousin of StatCard. Designed for resource usage,
 * quota tracking, and progress-bearing metrics. When `progress` is supplied,
 * a ProgressRing replaces the value position so the visual emphasises
 * the percentage.
 */
export function MetricTile({
  label,
  value,
  total,
  progress,
  trend = 'flat',
  period,
  icon,
  className,
}: MetricTileProps) {
  const trendMeta =
    trend === 'up'
      ? { Icon: ArrowUp, color: 'text-success-600' }
      : trend === 'down'
        ? { Icon: ArrowDown, color: 'text-danger-600' }
        : { Icon: Minus, color: 'text-muted-foreground' };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3',
        className
      )}
    >
      {progress != null && (
        <ProgressRing
          value={Math.max(0, Math.min(1, progress))}
          size={40}
          strokeWidth={4}
          aria-hidden
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon && <span className="flex h-3 w-3 items-center">{icon}</span>}
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-base font-semibold tracking-tight">{value}</span>
          {total && <span className="text-xs text-muted-foreground">/ {total}</span>}
        </div>
        {period && (
          <div className={cn('mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium', trendMeta.color)}>
            <trendMeta.Icon className="h-2.5 w-2.5" />
            <span>{period}</span>
          </div>
        )}
      </div>
    </div>
  );
}
