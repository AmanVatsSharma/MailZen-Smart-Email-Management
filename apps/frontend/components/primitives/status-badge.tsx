import { cn } from '@/lib/tokens/cn';
import { StatusDot } from './status-dot';

type StatusType = 'online' | 'offline' | 'syncing' | 'error' | 'pending' | 'success' | 'warning' | 'info' | 'neutral';

type StatusBadgeProps = {
  status: StatusType;
  label: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className
      )}
    >
      <StatusDot status={status} size="sm" />
      {label}
    </span>
  );
}
