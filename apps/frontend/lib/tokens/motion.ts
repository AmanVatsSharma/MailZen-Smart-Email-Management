export const motion = {
  duration: {
    instant: 0.1,
    fast:    0.2,
    base:    0.3,
    slow:    0.5,
    slower:  0.8,
  },
  easing: {
    linear:        [0, 0, 1, 1] as const,
    out:           [0, 0, 0.2, 1] as const,
    in:            [0.4, 0, 1, 1] as const,
    inOut:         [0.4, 0, 0.2, 1] as const,
    spring:        { type: 'spring' as const, stiffness: 400, damping: 30 },
    springBouncy:  { type: 'spring' as const, stiffness: 600, damping: 20 },
  },
  variants: {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slideUp: {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -8 },
    },
    slideInRight: {
      initial: { opacity: 0, x: 16 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 16 },
    },
    scaleIn: {
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.98 },
    },
  },
  stagger: (delay = 0.05) => ({
    animate: { transition: { staggerChildren: delay } },
  }),
  reducedMotion: { duration: 0, transition: { duration: 0 } },
} as const;
