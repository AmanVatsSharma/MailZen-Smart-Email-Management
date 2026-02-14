import * as React from 'react';
import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card/80 backdrop-blur-sm text-card-foreground flex flex-col gap-6 rounded-xl border border-slate-200/30 dark:border-slate-800/30 py-6 shadow-lg relative overflow-hidden',
        'before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-transparent before:opacity-50 before:rounded-xl',
        'after:absolute after:inset-0 after:bg-gradient-to-tr after:from-transparent after:to-primary/5 after:opacity-50 after:rounded-xl',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5 px-6 relative z-10', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div 
      data-slot="card-content" 
      className={cn('px-6 relative z-10', className)} 
      {...props} 
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div 
      data-slot="card-footer" 
      className={cn('flex items-center px-6 relative z-10', className)} 
      {...props} 
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
