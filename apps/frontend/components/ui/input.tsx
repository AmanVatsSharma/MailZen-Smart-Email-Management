import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = Omit<React.ComponentProps<'input'>, 'prefix' | 'suffix'> & {
  /**
   * Optional visual prefix rendered inside the input container (commonly an icon).
   * - Uses `pointer-events-none` by default so it doesn't block clicking the input.
   * - If you need an interactive element (rare), pass it via `suffix` and wrap it yourself.
   */
  prefix?: React.ReactNode;
  /**
   * Optional visual suffix rendered inside the input container (commonly an icon or action).
   */
  suffix?: React.ReactNode;
  /**
   * Optional className applied to the outer container when `prefix` or `suffix` is used.
   */
  containerClassName?: string;
};

function Input({ className, containerClassName, prefix, suffix, type, ...props }: InputProps) {
  const inputEl = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        // If an icon is provided, add default padding. Callers can override via `className`.
        prefix && 'pl-9',
        suffix && 'pr-9',
        className
      )}
      {...props}
    />
  );

  // Fast path: preserve the default shadcn-like Input DOM when no adornments are used.
  if (!prefix && !suffix) return inputEl;

  return (
    <div className={cn('relative flex items-center', containerClassName)}>
      {prefix ? (
        <div className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
          {prefix}
        </div>
      ) : null}
      {inputEl}
      {suffix ? (
        <div className="absolute right-3 flex items-center text-muted-foreground">{suffix}</div>
      ) : null}
    </div>
  );
}

export { Input };
