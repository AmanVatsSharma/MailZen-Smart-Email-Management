'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { motion } from 'framer-motion';
import { VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full',
  {
    variants: {
      size: {
        sm: 'size-8',
        md: 'size-10',
        lg: 'size-12',
        xl: 'size-16',
      },
      status: {
        online: 'ring-2 ring-emerald-500 dark:ring-emerald-500',
        busy: 'ring-2 ring-red-500 dark:ring-red-500',
        away: 'ring-2 ring-amber-500 dark:ring-amber-500',
        offline: 'ring-2 ring-slate-300 dark:ring-slate-700',
        premium: 'ring-2 ring-primary dark:ring-primary',
      },
      statusPosition: {
        'top-right': 'after:top-0 after:right-0',
        'bottom-right': 'after:bottom-0 after:right-0',
        'bottom-left': 'after:bottom-0 after:left-0',
        'top-left': 'after:top-0 after:left-0',
      },
      hasBadge: {
        true: '',
      },
    },
    compoundVariants: [
      {
        status: 'online',
        hasBadge: true,
        className: 'after:absolute after:block after:size-2.5 after:rounded-full after:bg-emerald-500 after:content-[""]',
      },
      {
        status: 'busy',
        hasBadge: true,
        className: 'after:absolute after:block after:size-2.5 after:rounded-full after:bg-red-500 after:content-[""]',
      },
      {
        status: 'away',
        hasBadge: true,
        className: 'after:absolute after:block after:size-2.5 after:rounded-full after:bg-amber-500 after:content-[""]',
      },
      {
        status: 'offline',
        hasBadge: true,
        className: 'after:absolute after:block after:size-2.5 after:rounded-full after:bg-slate-300 dark:after:bg-slate-700 after:content-[""]',
      },
      {
        status: 'premium',
        hasBadge: true,
        className: 'after:absolute after:block after:size-2.5 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent after:content-[""]',
      },
    ],
    defaultVariants: {
      size: 'md',
      statusPosition: 'bottom-right',
    },
  }
);

interface AvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  animate?: boolean;
}

const MotionAvatarRoot = motion(
  AvatarPrimitive.Root as unknown as React.ComponentType<Record<string, unknown>>
);

function Avatar({ 
  className, 
  size, 
  status, 
  statusPosition, 
  hasBadge, 
  animate = false,
  ...props 
}: AvatarProps) {
  const commonProps = {
    'data-slot': 'avatar',
    className: cn(avatarVariants({ size, status, statusPosition, hasBadge }), className),
  } as const;

  if (!animate) {
    return <AvatarPrimitive.Root {...commonProps} {...props} />;
  }

  // Motion's `onDrag` prop type conflicts with DOM `onDrag` on Radix Root.
  // Strip `onDrag` for the animated wrapper to avoid type incompatibilities.
  const { onDrag: _onDrag, ...motionSafeProps } = props;
  void _onDrag;

  return (
    <MotionAvatarRoot
      {...commonProps}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.05 }}
      {...motionSafeProps}
    />
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
}

interface AvatarFallbackProps extends React.ComponentProps<typeof AvatarPrimitive.Fallback> {
  gradient?: boolean;
  initials?: string;
}

function AvatarFallback({
  className,
  gradient = false,
  initials,
  ...props
}: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full font-medium',
        gradient 
          ? 'bg-gradient-to-br from-primary to-accent text-white' 
          : 'bg-muted text-muted-foreground',
        className
      )}
      {...props}
    >
      {initials || props.children}
    </AvatarPrimitive.Fallback>
  );
}

/**
 * PremiumAvatar component with animation and premium styling
 * Usage:
 * <PremiumAvatar initials="JD" status="online" />
 * <PremiumAvatar src="/path/to/image.jpg" status="premium" />
 */
interface PremiumAvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'busy' | 'away' | 'offline' | 'premium';
  statusPosition?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left';
  className?: string;
}

function PremiumAvatar({
  src,
  alt,
  initials,
  size = 'md',
  status,
  statusPosition = 'bottom-right',
  className,
}: PremiumAvatarProps) {
  return (
    <Avatar 
      animate 
      size={size} 
      status={status} 
      statusPosition={statusPosition} 
      hasBadge={!!status} 
      className={className}
    >
      {src ? (
        <AvatarImage src={src} alt={alt || initials || ''} />
      ) : (
        <AvatarFallback gradient initials={initials} />
      )}
    </Avatar>
  );
}

export { Avatar, AvatarImage, AvatarFallback, PremiumAvatar };
