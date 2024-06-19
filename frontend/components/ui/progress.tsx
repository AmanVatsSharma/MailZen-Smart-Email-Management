'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorColor?: string;
  }
>(({ className, value, indicatorColor, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      'relative h-3 w-full overflow-hidden rounded-full bg-secondary/20 backdrop-blur-sm',
      className
    )}
    {...props}
  >
    <motion.div
      className={cn(
        'h-full w-full flex-1 bg-gradient-to-r from-primary to-primary/80 transition-all',
        indicatorColor
      )}
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
      }}
      initial={{ opacity: 0, x: '-100%' }}
      animate={{ 
        opacity: 1, 
        x: `${-(100 - (value || 0))}%`,
        transition: { 
          duration: 0.8, 
          ease: 'easeOut' 
        }
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-50 rounded-full" />
    </motion.div>
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
