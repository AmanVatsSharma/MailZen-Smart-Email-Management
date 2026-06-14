import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/tokens/cn';

export type StatCardProps = {
  /** Short label shown above the value (e.g. "Inbox Zero Days") */
  label: string;
  /** The headline value to display (string so the consumer can format, e.g. "$12,400" or "12.4k") */
  value: string;
  /** Optional delta indicator */
  delta?: {
    /** Numeric or formatted delta value (e.g. "+8" or "8%") */
    value: string | number;
    /** Trend direction */
    trend: 'up' | 'down' | 'flat';
    /** Optional period label (e.g. "vs last week") */
    period?: string;
  };
  /** Optional icon shown in the top-right */
  icon?: React.ReactNode;
  /** Click handler — when provided, the card becomes a button */
  onClick?: () => void;
  /** Optional helper text below the value */
  helper?: string;
  className?: string;
};

/**
 * StatCard — a single-metric summary tile.
 *
 * Used on dashboards, analytics pages, and any surface that needs to surface
 * one headline number with optional trend. Becomes interactive (button with
 * `aria-label`) when `onClick` is provided.
 */
export function StatCard({
  label,
  value,
  delta,
  icon,
  onClick,
  helper,
  className,
}: StatCardProps) {
  const trendMeta = delta
    ? delta.trend === 'up'
      ? { Icon: ArrowUp, color: 'text-success-600', label: 'up' }
      : delta.trend === 'down'
        ? { Icon: ArrowDown, color: 'text-danger-600', label: 'down' }
        : { Icon: Minus, color: 'text-muted-foreground', label: 'flat' }
    : null;

  const interactive = !!onClick;
  const accessibleLabel = interactive
    ? `${label}: ${value}${delta ? `, ${delta.value} ${trendMeta?.label} ${delta.period ?? ''}` : ''}`
    : undefined;

  const Tag = interactive ? 'button' : 'div';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tagProps: any = interactive
    ? { onClick, type: 'button', 'aria-label': accessibleLabel }
    : {};

  return (
    <Tag
      {...tagProps}
      className={cn(
        'block w-full text-left rounded-lg border border-border-subtle bg-surface-1 p-4',
        'transition-colors',
        interactive && 'hover:bg-surface-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground flex h-4 w-4 items-center">{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {(delta || helper) && (
        <div className="mt-2 flex items-baseline gap-1.5 text-xs">
          {delta && trendMeta && (
            <>
              <span className={cn('inline-flex items-center gap-0.5 font-medium', trendMeta.color)}>
                <trendMeta.Icon className="h-3 w-3" />
                <span>{delta.value}</span>
              </span>
              {delta.period && <span className="text-muted-foreground">{delta.period}</span>}
            </>
          )}
          {helper && <span className="text-muted-foreground">{helper}</span>}
        </div>
      )}
    </Tag>
  );
}
