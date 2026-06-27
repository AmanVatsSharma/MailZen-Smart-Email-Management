import { ReactNode, useId } from 'react';
import { cn } from '@/lib/tokens/cn';

type FieldProps = {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  description,
  error,
  required,
  hint,
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  // Clone child to inject aria-describedby and aria-invalid
  const child = Array.isArray(children) ? children[0] : children;
  const childWithProps =
    child && typeof child === 'object' && 'props' in child
      ? {
          ...child,
          props: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(child as any).props,
            id,
            'aria-describedby': error ? errorId : description ? descriptionId : undefined,
            'aria-invalid': error ? true : undefined,
          },
        }
      : child;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && (
            <span aria-label="required" className="text-destructive ms-0.5">
              *
            </span>
          )}
        </label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {description && !error && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {childWithProps}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}