import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive relative overflow-hidden",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/10 after:to-transparent after:opacity-0 hover:after:opacity-100',
        destructive:
          'bg-destructive text-white shadow-lg hover:shadow-xl hover:shadow-destructive/20 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/10 after:to-transparent after:opacity-0 hover:after:opacity-100',
        outline:
          'border border-input bg-background/80 backdrop-blur-sm shadow-lg hover:shadow-xl hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 active:translate-y-0 active:shadow-md after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/10 after:to-transparent after:opacity-0 hover:after:opacity-100',
        secondary: 'bg-secondary text-secondary-foreground shadow-lg hover:shadow-xl hover:shadow-secondary/20 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/10 after:to-transparent after:opacity-0 hover:after:opacity-100',
        ghost: 'hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 active:translate-y-0',
        link: 'text-primary underline-offset-4 hover:underline hover:text-primary/80',
        premium: 'bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md after:absolute after:inset-0 after:bg-gradient-to-tr after:from-white/10 after:to-transparent after:opacity-0 hover:after:opacity-100',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const MotionButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>((props, ref) => {
  return <button ref={ref} {...props} />;
});
MotionButton.displayName = 'MotionButton';
const MotionComp = motion(MotionButton);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }

  // Motion's `onDrag` prop type conflicts with the DOM `onDrag` prop type.
  const {
    onDrag: _onDrag,
    onDragStart: _onDragStart,
    onDragEnd: _onDragEnd,
    onDragEnter: _onDragEnter,
    onDragLeave: _onDragLeave,
    onDragOver: _onDragOver,
    onDrop: _onDrop,
    onAnimationStart: _onAnimationStart,
    onAnimationEnd: _onAnimationEnd,
    onAnimationIteration: _onAnimationIteration,
    ...motionSafeProps
  } = props;
  void _onDrag;
  void _onDragStart;
  void _onDragEnd;
  void _onDragEnter;
  void _onDragLeave;
  void _onDragOver;
  void _onDrop;
  void _onAnimationStart;
  void _onAnimationEnd;
  void _onAnimationIteration;

  return (
    <MotionComp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      {...motionSafeProps}
    />
  );
}

export { Button, buttonVariants };
