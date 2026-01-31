'use client';

import { cn } from '@/lib/utils';
import React, { useEffect, useRef, useState } from 'react';

export const BackgroundGradient = ({
  className,
  containerClassName,
  animate = true,
}: {
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate) return;
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { width, height } = container.getBoundingClientRect();
      const x = clientX / width;
      const y = clientY / height;
      container.style.setProperty('--mouse-x', x.toString());
      container.style.setProperty('--mouse-y', y.toString());
    };

    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [animate]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute inset-0 -z-10 overflow-hidden bg-background',
        containerClassName
      )}
    >
      <div
        className={cn(
          'absolute inset-0 opacity-30 blur-[100px] transition-opacity duration-500',
          'bg-[radial-gradient(circle_at_var(--mouse-x,0.5)_var(--mouse-y,0.5),var(--primary)_0%,transparent_50%)]',
          className
        )}
      />
      <div className="absolute inset-0 bg-grid-slate-200/20 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-800/20" />
    </div>
  );
};
