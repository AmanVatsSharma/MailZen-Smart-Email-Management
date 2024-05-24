import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const cardVariants = {
  hover: {
    y: -5,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    transition: { type: "spring", stiffness: 300, damping: 20 }
  }
};

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <motion.div
      data-slot="card"
      initial={{ opacity: 0.9 }}
      animate={{ opacity: 1 }}
      whileHover="hover"
      variants={cardVariants}
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
    <motion.div
      data-slot="card-header"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className={cn('flex flex-col gap-1.5 px-6 relative z-10', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <motion.div
      data-slot="card-title"
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn('leading-none font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <motion.div
      data-slot="card-description"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <motion.div 
      data-slot="card-content" 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className={cn('px-6 relative z-10', className)} 
      {...props} 
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <motion.div 
      data-slot="card-footer" 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className={cn('flex items-center px-6 relative z-10', className)} 
      {...props} 
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
