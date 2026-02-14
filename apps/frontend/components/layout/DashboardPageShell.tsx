import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardPageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function DashboardPageShell({
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
  titleClassName,
  descriptionClassName,
}: DashboardPageShellProps) {
  return (
    <section className={cn('flex h-full flex-col gap-4', className)}>
      <header
        className={cn(
          'flex flex-col gap-3 md:flex-row md:items-start md:justify-between',
          headerClassName,
        )}
      >
        <div className="space-y-1">
          <h1 className={cn('text-2xl font-semibold tracking-tight', titleClassName)}>
            {title}
          </h1>
          {description ? (
            <p className={cn('text-sm text-muted-foreground', descriptionClassName)}>
              {description}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      <div className={cn('min-h-0 flex-1', contentClassName)}>{children}</div>
    </section>
  );
}
