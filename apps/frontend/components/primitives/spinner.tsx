import { cn } from '@/lib/tokens/cn';
import { Loader2 } from 'lucide-react';

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';

  return (
    <Loader2
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn('animate-spin', sizeClass, className)}
    />
  );
}
