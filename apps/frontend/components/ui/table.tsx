'use client';

import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

const tableContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const tableRowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
};

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto rounded-lg border border-slate-200/30 dark:border-slate-800/30 bg-card/80 backdrop-blur-sm shadow-md">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead 
      data-slot="table-header" 
      className={cn('[&_tr]:border-b bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm', className)} 
      {...props} 
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

interface AnimatedTableRowProps
  extends Omit<
    React.ComponentProps<'tr'>,
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
  index?: number;
  isAnimated?: boolean;
}

function TableRow({ 
  className, 
  index = 0, 
  isAnimated = false, 
  ...props 
}: AnimatedTableRowProps) {
  if (isAnimated) {
    return (
      <motion.tr
        data-slot="table-row"
        variants={tableRowVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: index * 0.05 }}
        className={cn(
          'hover:bg-accent/5 data-[state=selected]:bg-accent/10 border-b border-slate-200/30 dark:border-slate-800/30 transition-colors',
          className
        )}
        {...props}
      />
    );
  }

  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-accent/5 data-[state=selected]:bg-accent/10 border-b border-slate-200/30 dark:border-slate-800/30 transition-all duration-200',
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-muted-foreground h-10 px-4 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-4 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  );
}

/**
 * AnimatedTable provides a table component with animated row entrance
 * Usage:
 * <AnimatedTable>
 *   <TableHeader>...</TableHeader>
 *   <AnimatedTableBody>
 *     {items.map((item, index) => (
 *       <AnimatedTableRow key={item.id} index={index}>
 *         <TableCell>{item.name}</TableCell>
 *         ...
 *       </AnimatedTableRow>
 *     ))}
 *   </AnimatedTableBody>
 * </AnimatedTable>
 */

function AnimatedTable({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <motion.div 
      data-slot="table-container" 
      className="relative w-full overflow-x-auto rounded-lg border border-slate-200/30 dark:border-slate-800/30 bg-card/80 backdrop-blur-sm shadow-md"
      variants={tableContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </motion.div>
  );
}

function AnimatedTableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function AnimatedTableRow({ 
  className, 
  index = 0, 
  ...props 
}: AnimatedTableRowProps) {
  // Used only to preserve deterministic stagger potential; suppress unused var lint for now.
  void index;
  return (
    <motion.tr
      data-slot="table-row"
      variants={tableRowVariants}
      className={cn(
        'hover:bg-accent/5 data-[state=selected]:bg-accent/10 border-b border-slate-200/30 dark:border-slate-800/30 transition-colors',
        className
      )}
      {...props}
    />
  );
}

export { 
  Table, 
  TableHeader, 
  TableBody, 
  TableFooter, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableCaption,
  AnimatedTable,
  AnimatedTableBody,
  AnimatedTableRow
};
