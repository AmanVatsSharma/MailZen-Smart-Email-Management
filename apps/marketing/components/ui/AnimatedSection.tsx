'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedSectionProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  once?: boolean;
}

export function AnimatedSection({
  children,
  delay = 0,
  className,
  direction = 'up',
  once = true,
}: AnimatedSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: '-60px' });

  const initialY = direction === 'up' ? 32 : direction === 'down' ? -32 : 0;
  const initialX = direction === 'left' ? 32 : direction === 'right' ? -32 : 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: initialY, x: initialX }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: initialY, x: initialX }}
      transition={{
        duration: 0.6,
        delay,
        ease: 'easeOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
}: StaggerContainerProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        visible: { transition: { staggerChildren: staggerDelay } },
        hidden: {},
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};
