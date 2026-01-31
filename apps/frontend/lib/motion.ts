/**
 * Shared motion presets for MailZen UI.
 *
 * Why this exists:
 * - Keep animations consistent (Apple-like, subtle, premium).
 * - Centralize spring configuration so tweaks are easy and global.
 * - Avoid repeating "magic numbers" across components.
 */
import type { Transition, Variants } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';

/**
 * Premium spring tuned for UI micro-interactions.
 * - Snappy but not bouncy.
 * - Works well for opacity/translate/scale transitions.
 */
export const springPremium: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: springPremium },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  show: { opacity: 1, scale: 1, transition: springPremium },
};

/**
 * Helper hook to choose a safe animation strategy when the user prefers reduced motion.
 */
export function useMotionSafe() {
  const reduced = useReducedMotion();
  return {
    reduced,
    /**
     * Return a transition that is either disabled (0 duration) or the provided transition.
     */
    transition: (t: Transition) => (reduced ? { duration: 0 } : t),
  };
}

