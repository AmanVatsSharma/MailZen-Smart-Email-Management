export const fontSize = {
  xs:   'var(--font-size-xs)',
  sm:   'var(--font-size-sm)',
  base: 'var(--font-size-base)',
  lg:   'var(--font-size-lg)',
  xl:   'var(--font-size-xl)',
  '2xl': 'var(--font-size-2xl)',
  '3xl': 'var(--font-size-3xl)',
  '4xl': 'var(--font-size-4xl)',
} as const;

export const lineHeight = {
  tight:   'var(--line-height-tight)',
  snug:    'var(--line-height-snug)',
  normal:  'var(--line-height-normal)',
  relaxed: 'var(--line-height-relaxed)',
} as const;

export const letterSpacing = {
  tight:  'var(--letter-spacing-tight)',
  normal: 'var(--letter-spacing-normal)',
  wide:   'var(--letter-spacing-wide)',
} as const;
