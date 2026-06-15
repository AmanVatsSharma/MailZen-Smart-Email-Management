import { cn } from '@/lib/tokens/cn';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

type StatusType = 'online' | 'offline' | 'syncing' | 'error' | 'pending' | 'success' | 'warning' | 'info' | 'neutral';

const STATUS_COLORS: Record<StatusType, string> = {
  online: 'bg-success-500',
  offline: 'bg-gray-400',
  syncing: 'bg-info-500',
  error: 'bg-danger-500',
  pending: 'bg-warning-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  info: 'bg-info-500',
  neutral: 'bg-gray-400',
};

type StatusDotProps = {
  status: StatusType;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function StatusDot({ status, pulse, size = 'md', className }: StatusDotProps) {
  const reducedMotion = useReducedMotion();
  const shouldPulse = pulse && !reducedMotion;
  const sizeClass = size === 'sm' ? 'h-2 w-2' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3';

  return (
    <span
      role="status"
      aria-label={status}
      className={cn(
        'inline-block rounded-full',
        sizeClass,
        STATUS_COLORS[status],
        shouldPulse && 'animate-pulse',
        className
      )}
    />
  );
}
