'use client';

import React, { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const TiltCard = ({
  children,
  className,
  containerClassName,
}: TiltCardProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

  function onMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    x.set(clientX - left - width / 2);
    y.set(clientY - top - height / 2);
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  const rotateX = useMotionTemplate`${mouseY}deg`;
  const rotateY = useMotionTemplate`${mouseX}deg`;

  return (
    <div
      className={cn(
        "relative group/card perspective-1000",
        containerClassName
      )}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      ref={ref}
    >
      <motion.div
        style={{
          transformStyle: "preserve-3d",
          rotateX: useMotionTemplate`calc(${rotateX} / 20)`,
          rotateY: useMotionTemplate`calc(${rotateY} / 20)`,
        }}
        className={cn(
          "relative h-full w-full transition-all duration-200 ease-linear",
          className
        )}
      >
        {children}
      </motion.div>
    </div>
  );
};
