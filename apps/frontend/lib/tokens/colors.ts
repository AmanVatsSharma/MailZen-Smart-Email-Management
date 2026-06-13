/**
 * Color token API for JS/TS consumers (chart libraries, inline styles).
 * Returns CSS variable references, not literal values.
 */
export const brand = {
  50:  'var(--color-brand-50)',
  100: 'var(--color-brand-100)',
  200: 'var(--color-brand-200)',
  300: 'var(--color-brand-300)',
  400: 'var(--color-brand-400)',
  500: 'var(--color-brand-500)',
  600: 'var(--color-brand-600)',
  700: 'var(--color-brand-700)',
  800: 'var(--color-brand-800)',
  900: 'var(--color-brand-900)',
} as const;

export const surface = {
  0: 'var(--color-surface-0)',
  1: 'var(--color-surface-1)',
  2: 'var(--color-surface-2)',
  3: 'var(--color-surface-3)',
  inverse: 'var(--color-surface-inverse)',
} as const;

export const status = {
  success: 'var(--color-success-500)',
  warning: 'var(--color-warning-500)',
  danger:  'var(--color-danger-500)',
  info:    'var(--color-info-500)',
} as const;

export const border = {
  subtle:  'var(--color-border-subtle)',
  default: 'var(--color-border-default)',
  strong:  'var(--color-border-strong)',
} as const;

export const ring = 'var(--color-ring)';
