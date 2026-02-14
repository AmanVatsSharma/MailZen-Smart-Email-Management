'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { scaleIn, springPremium } from '@/lib/motion';

/**
 * A reusable premium surface wrapper (Apple-like glass).
 *
 * Use this for panels/containers (not necessarily for content cards),
 * so inbox panels + shell surfaces feel consistent and maintainable.
 */
export interface SurfaceProps
  extends Omit<
    React.ComponentProps<'div'>,
    | 'onDrag'
    | 'onDragStart'
    | 'onDragEnd'
    | 'onDragEnter'
    | 'onDragLeave'
    | 'onDragOver'
    | 'onDrop'
    | 'onAnimationStart'
    | 'onAnimationEnd'
    | 'onAnimationIteration'
  > {
  /**
   * Visual treatment for the surface.
   * - glass: translucent + blur + subtle gradients (default)
   * - elevated: more opaque with stronger shadow
   * - subtle: minimal border/background for nested areas
   */
  variant?: 'glass' | 'elevated' | 'subtle';
  /**
   * Whether this surface should have a hover lift. Useful for clickable panels.
   */
  interactive?: boolean;
  /**
   * Whether to animate on mount. Keep true for top-level surfaces.
   */
  animateIn?: boolean;
}

export function Surface({
  className,
  variant = 'glass',
  interactive = false,
  animateIn = true,
  ...props
}: SurfaceProps) {
  return (
    <motion.div
      data-slot="surface"
      variants={scaleIn}
      initial={animateIn ? 'hidden' : false}
      animate={animateIn ? 'show' : undefined}
      whileHover={
        interactive
          ? {
              y: -2,
              transition: springPremium,
            }
          : undefined
      }
      className={cn(
        // Base
        'relative overflow-hidden rounded-xl border shadow-sm',
        // Backdrop
        'bg-background/70 backdrop-blur-md',
        'border-slate-200/40 dark:border-slate-800/40',
        // Premium gradient overlays
        'before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/6 before:to-transparent before:opacity-70',
        'after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-tr after:from-transparent after:to-primary/6 after:opacity-60',
        // Variants
        variant === 'glass' && 'shadow-md',
        variant === 'elevated' && 'bg-background/85 shadow-lg',
        variant === 'subtle' && 'bg-background/40 shadow-none',
        // Interactive polish
        interactive &&
          'transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/10',
        className
      )}
      {...props}
    />
  );
}

