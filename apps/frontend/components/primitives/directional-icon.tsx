'use client';

import * as React from 'react';
import { cn } from '@/lib/tokens/cn';
import { useDirection } from '@/lib/hooks/useDirection';

/**
 * DirectionalIcon
 * -----------------------------------------------------------------------------
 * Renders a horizontal icon (e.g. `ChevronRight`, `ArrowRight`) that should
 * flip in RTL contexts. The icon itself stays the same, but we apply a
 * `scale-x-[-1]` transform when the document is in RTL mode. This means
 * "next" / "previous" still read correctly in both directions.
 *
 * Usage:
 *   <DirectionalIcon Icon={ChevronRight} className="h-4 w-4" />
 *
 * Note: For purely decorative icons that are already symmetric, don't use
 * this — it adds an extra wrapper DOM node. Use it only for icons that have
 * a clear "left vs right" semantic.
 */
type DirectionalIconProps = {
  Icon: React.ComponentType<{ className?: string }>;
  className?: string;
};

export function DirectionalIcon({ Icon, className }: DirectionalIconProps) {
  const dir = useDirection();
  return (
    <Icon
      className={cn(className, dir === 'rtl' && 'scale-x-[-1]')}
    />
  );
}
