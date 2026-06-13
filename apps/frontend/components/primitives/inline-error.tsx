// components/primitives/inline-error.tsx
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/tokens/cn';

type InlineErrorProps = {
  error: Error;
  onRetry?: () => void;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
};

export function InlineError({
  error,
  onRetry,
  title = 'Something went wrong',
  description,
  compact = false,
  className,
}: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {description ?? error.message}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          aria-label="Retry"
        >
          Retry
        </Button>
      )}
    </div>
  );
}
