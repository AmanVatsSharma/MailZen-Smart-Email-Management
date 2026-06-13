import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/tokens/cn';

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  tooltip?: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'outline';
}

export function IconButton({
  icon,
  tooltip,
  size = 'sm',
  variant = 'ghost',
  className,
  ...props
}: IconButtonProps) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const base =
    'inline-flex shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50';
  const variantClass =
    variant === 'ghost'
      ? 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      : 'border border-border/60 bg-card text-muted-foreground hover:bg-accent/60 hover:text-foreground';

  const button = (
    <button className={cn(base, dim, variantClass, className)} {...props}>
      {icon}
    </button>
  );

  if (!tooltip) return button;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
