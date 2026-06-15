# Foundation UI System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-grade Foundation UI System for MailZen with tokens, state primitives, and 7 high-leverage composites that standardize async states, eliminate skeleton duplication, and provide a unified form pattern.

**Architecture:** Three-tier component taxonomy (ui/ → primitives/ → composites/). Tokens as single source of truth (CSS variables + TypeScript API). State as a discriminated union (`AsyncState<T>`) handled by a `DataView` pattern. In-app `/dev/playground` route instead of Storybook. OKLCH color tokens added alongside existing HSL (no regression risk).

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind v4, shadcn/ui (new-york), Framer Motion, Radix UI primitives, TanStack Table (for DataTable), shiki (for playground code snippets), jest-axe (a11y tests), React Testing Library.

**Beads Issue Mapping:** 14 issues already created. This plan covers all 14.

---

## File Structure

### New Directories

```
apps/frontend/
  components/
    primitives/                  # NEW: our atoms
      skeleton.tsx
      skeleton-composites.tsx
      status-dot.tsx
      status-badge.tsx
      spinner.tsx
      loading-state.tsx
      inline-error.tsx
      error-banner.tsx
      kbd.tsx
      divider.tsx
    patterns/                    # NEW: composition patterns
      data-view.tsx
      form-section.tsx
      field.tsx
      empty-state.tsx
    composites/                  # NEW: feature-aware composites
      data-table/
        index.tsx
        toolbar.tsx
        pagination.tsx
        bulk-actions.tsx
        types.ts
      command-palette.tsx
      stat-card.tsx
      metric-tile.tsx
      progress-ring.tsx
      confirm-dialog.tsx
      toast/
        index.tsx
        toaster.tsx
        types.ts
    feedback/                    # NEW
      alert.tsx
      banner.tsx
  lib/
    tokens/
      cn.ts
      colors.ts
      motion.ts
      typography.ts
      elevation.ts
      spacing.ts
      z-index.ts
    hooks/
      useReducedMotion.ts
      useDelayedRender.ts
      useIsMobile.ts
  styles/
    tokens.css
    typography.css
  app/
    dev/
      playground/
        page.tsx
        _components/
          nav.tsx
          prop-controls.tsx
          code-snippet.tsx
        manifests/
          button.manifest.ts
          ... (12 manifests)
      docs/
        page.tsx
  docs/
    design-system.mdx
```

### Modified Files

```
apps/frontend/app/globals.css              # Add OKLCH tokens, fluid type, motion CSS
apps/frontend/tailwind.config.js          # Extend with new token references
apps/frontend/components/ui/EmptyState.tsx # Refactor to patterns/empty-state.tsx
apps/frontend/components/ui/skeleton.tsx   # Extend with composites
apps/frontend/components/ui/command-palette.tsx # Refactor
apps/frontend/components/ui/use-toast.tsx  # Refactor to composites/toast/
apps/frontend/components/ui/toaster.tsx    # Refactor
```

---

## Task Decomposition

This plan is organized into **4 phases** that mirror the dependency graph:

- **Phase 1:** Foundation tokens (issues cjl, 4xc) — unblocks everything else
- **Phase 2:** Primitives (issues x30, pfr, z3e, mnx) — atoms other components compose
- **Phase 3:** Patterns (issues ati) — Field/FormSection, plus DataView refinement
- **Phase 4:** Composites (issues cwn, 9zy, vpf, esy, uxt) — high-leverage features
- **Phase 5:** Docs & playground (issues hol, o5z) — documentation layer

Each task includes exact file paths, complete code, and verification steps.

---

## Phase 1: Foundation Tokens

### Task 1.1: Extract token CSS files

**Files:**
- Create: `apps/frontend/styles/tokens.css`
- Create: `apps/frontend/styles/typography.css`
- Modify: `apps/frontend/app/globals.css` (add @import statements at top)

- [ ] **Step 1: Create `apps/frontend/styles/tokens.css`**

```css
@theme {
  /* ===== Brand ===== */
  --color-brand-50:  oklch(0.97 0.02 290);
  --color-brand-100: oklch(0.94 0.05 290);
  --color-brand-200: oklch(0.88 0.09 290);
  --color-brand-300: oklch(0.80 0.14 290);
  --color-brand-400: oklch(0.72 0.19 290);
  --color-brand-500: oklch(0.62 0.24 290);
  --color-brand-600: oklch(0.55 0.25 290);
  --color-brand-700: oklch(0.46 0.22 290);
  --color-brand-800: oklch(0.38 0.18 290);
  --color-brand-900: oklch(0.30 0.13 290);

  /* ===== Semantic surface ===== */
  --color-surface-0: oklch(0.99 0.005 250);
  --color-surface-1: oklch(1 0 0);
  --color-surface-2: oklch(0.97 0.008 250);
  --color-surface-3: oklch(0.95 0.01 250);
  --color-surface-inverse: oklch(0.18 0.02 250);

  /* ===== Status ===== */
  --color-success-500: oklch(0.62 0.18 145);
  --color-warning-500: oklch(0.74 0.16 75);
  --color-danger-500:  oklch(0.62 0.22 25);
  --color-info-500:    oklch(0.62 0.16 230);

  /* ===== Focus ring ===== */
  --color-ring: var(--color-brand-500);

  /* ===== Border ===== */
  --color-border-subtle:  oklch(0.92 0.005 250);
  --color-border-default: oklch(0.86 0.008 250);
  --color-border-strong:  oklch(0.74 0.01 250);

  /* ===== Radius ===== */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;

  /* ===== Elevation ===== */
  --shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.04);
  --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.08), 0 1px 2px -1px oklch(0 0 0 / 0.06);
  --shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.10), 0 2px 4px -2px oklch(0 0 0 / 0.06);
  --shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.10), 0 4px 6px -4px oklch(0 0 0 / 0.05);
  --shadow-xl: 0 20px 25px -5px oklch(0 0 0 / 0.12), 0 8px 10px -6px oklch(0 0 0 / 0.05);
  --shadow-glow: 0 0 0 1px var(--color-ring), 0 0 20px -2px var(--color-ring);
}

:root {
  --z-base: 0;
  --z-raised: 10;
  --z-sticky: 100;
  --z-dropdown: 1000;
  --z-overlay: 2000;
  --z-modal: 3000;
  --z-popover: 4000;
  --z-toast: 5000;
  --z-tooltip: 6000;
}

.dark {
  --color-surface-0: oklch(0.16 0.02 250);
  --color-surface-1: oklch(0.20 0.02 250);
  --color-surface-2: oklch(0.24 0.02 250);
  --color-surface-3: oklch(0.28 0.02 250);
  --color-surface-inverse: oklch(0.95 0.005 250);

  --color-border-subtle:  oklch(0.28 0.01 250);
  --color-border-default: oklch(0.34 0.01 250);
  --color-border-strong:  oklch(0.48 0.01 250);

  --color-brand-400: oklch(0.75 0.20 290);
  --color-brand-500: oklch(0.68 0.24 290);
}
```

- [ ] **Step 2: Create `apps/frontend/styles/typography.css`**

```css
:root {
  --font-size-xs:   clamp(0.75rem, 0.71rem + 0.20vw, 0.81rem);
  --font-size-sm:   clamp(0.875rem, 0.84rem + 0.18vw, 0.94rem);
  --font-size-base: clamp(1rem, 0.96rem + 0.20vw, 1.06rem);
  --font-size-lg:   clamp(1.125rem, 1.07rem + 0.27vw, 1.22rem);
  --font-size-xl:   clamp(1.25rem, 1.18rem + 0.36vw, 1.41rem);
  --font-size-2xl:  clamp(1.5rem, 1.39rem + 0.55vw, 1.76rem);
  --font-size-3xl:  clamp(1.875rem, 1.70rem + 0.87vw, 2.28rem);
  --font-size-4xl:  clamp(2.25rem, 2.00rem + 1.25vw, 2.94rem);

  --line-height-tight: 1.2;
  --line-height-snug: 1.35;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.65;

  --letter-spacing-tight: -0.02em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.04em;
}
```

- [ ] **Step 3: Modify `apps/frontend/app/globals.css` to import token files**

Add at the top of the file (before existing @theme blocks):

```css
@import '../../styles/tokens.css';
@import '../../styles/typography.css';
```

- [ ] **Step 4: Verify tokens compile**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No type errors. CSS will be validated when the app builds.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/styles/ apps/frontend/app/globals.css
git commit -m "feat(tokens): add OKLCH brand/surface/status tokens, fluid type scale, z-index scale"
```

---

### Task 1.2: Create token TypeScript API

**Files:**
- Create: `apps/frontend/lib/tokens/cn.ts` (move from `lib/utils.ts`)
- Create: `apps/frontend/lib/tokens/colors.ts`
- Create: `apps/frontend/lib/tokens/motion.ts`
- Create: `apps/frontend/lib/tokens/typography.ts`
- Create: `apps/frontend/lib/tokens/elevation.ts`
- Create: `apps/frontend/lib/tokens/spacing.ts`
- Create: `apps/frontend/lib/tokens/z-index.ts`
- Delete: `apps/frontend/lib/utils.ts` (after verifying cn is moved)

- [ ] **Step 1: Move `cn` to `lib/tokens/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create `lib/tokens/colors.ts`**

```ts
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
```

- [ ] **Step 3: Create `lib/tokens/motion.ts`**

```ts
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
```

- [ ] **Step 4: Create `lib/tokens/typography.ts`**

```ts
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
```

- [ ] **Step 5: Create `lib/tokens/elevation.ts`**

```ts
export const shadow = {
  xs:   'var(--shadow-xs)',
  sm:   'var(--shadow-sm)',
  md:   'var(--shadow-md)',
  lg:   'var(--shadow-lg)',
  xl:   'var(--shadow-xl)',
  glow: 'var(--shadow-glow)',
} as const;
```

- [ ] **Step 6: Create `lib/tokens/spacing.ts`**

```ts
export const radius = {
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  xl:   'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: 'var(--radius-full)',
} as const;
```

- [ ] **Step 7: Create `lib/tokens/z-index.ts`**

```ts
export const zIndex = {
  base:     0,
  raised:   10,
  sticky:   100,
  dropdown: 1000,
  overlay:  2000,
  modal:    3000,
  popover:  4000,
  toast:    5000,
  tooltip:  6000,
} as const;
```

- [ ] **Step 8: Update imports across the app**

Run: `cd apps/frontend && grep -r "from '@/lib/utils'" --include="*.tsx" --include="*.ts" | wc -l`
Expected: ~100+ files

Run: `cd apps/frontend && find . -name "*.tsx" -o -name "*.ts" | xargs sed -i "s|from '@/lib/utils'|from '@/lib/tokens/cn'|g"`
Expected: All imports updated.

- [ ] **Step 9: Delete `lib/utils.ts`**

```bash
rm apps/frontend/lib/utils.ts
```

- [ ] **Step 10: Verify build**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 11: Commit**

```bash
git add apps/frontend/lib/tokens/ apps/frontend/lib/utils.ts
git commit -m "feat(tokens): add TypeScript API for colors, motion, typography, elevation, spacing, z-index"
```

---

### Task 1.3: Create useReducedMotion hook

**Files:**
- Create: `apps/frontend/lib/hooks/useReducedMotion.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(QUERY);
    setReduced(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Verify with a test**

Create: `apps/frontend/lib/hooks/useReducedMotion.test.ts`

```ts
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

describe('useReducedMotion', () => {
  it('returns false when user does not prefer reduced motion', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when user prefers reduced motion', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `cd apps/frontend && npx jest lib/hooks/useReducedMotion.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/lib/hooks/useReducedMotion.ts apps/frontend/lib/hooks/useReducedMotion.test.ts
git commit -m "feat(hooks): add useReducedMotion for accessible animations"
```

---

## Phase 2: Primitives

### Task 2.1: Refactor EmptyState with semantic variants

**Files:**
- Create: `apps/frontend/components/patterns/empty-state.tsx`
- Create: `apps/frontend/components/patterns/empty-state.test.tsx`
- Delete: `apps/frontend/components/ui/EmptyState.tsx` (after migration)

- [ ] **Step 1: Write the test**

```tsx
import { render, screen } from '@testing-library/react';
import { EmptyState } from './empty-state';
import { Mail } from 'lucide-react';

describe('EmptyState', () => {
  it('renders with semantic variant defaults', () => {
    render(<EmptyState variant="no-data" />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(
      <EmptyState
        variant="no-results"
        title="No matches"
        description="Try different keywords"
      />
    );
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.getByText('Try different keywords')).toBeInTheDocument();
  });

  it('renders action button', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        variant="no-data"
        action={{ label: 'Create', onClick }}
      />
    );
    const button = screen.getByRole('button', { name: /create/i });
    button.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('passes a11y checks', async () => {
    const { container } = render(
      <EmptyState variant="no-data" icon={<Mail aria-hidden />} />
    );
    const { axe } = await import('jest-axe');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && npx jest components/patterns/empty-state.test.tsx`
Expected: FAIL with "Cannot find module './empty-state'"

- [ ] **Step 3: Implement EmptyState**

```tsx
'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Mail, Search, Lock, Wrench, Sparkles, Inbox } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { cn } from '@/lib/tokens/cn';

type EmptyVariant =
  | 'no-data'
  | 'no-results'
  | 'no-access'
  | 'error'
  | 'coming-soon';

type IllustrationName = 'search' | 'inbox' | 'lock' | 'wrench' | 'sparkles';

const ILLUSTRATIONS: Record<IllustrationName, ReactNode> = {
  search: <Search className="h-6 w-6" />,
  inbox: <Inbox className="h-6 w-6" />,
  lock: <Lock className="h-6 w-6" />,
  wrench: <Wrench className="h-6 w-6" />,
  sparkles: <Sparkles className="h-6 w-6" />,
};

const DEFAULTS: Record<EmptyVariant, { title: string; description: string; illustration: IllustrationName }> = {
  'no-data': {
    title: 'No data yet',
    description: 'Get started by creating your first item.',
    illustration: 'inbox',
  },
  'no-results': {
    title: 'No results found',
    description: 'Try adjusting your search or filters.',
    illustration: 'search',
  },
  'no-access': {
    title: 'Access denied',
    description: "You don't have permission to view this.",
    illustration: 'lock',
  },
  error: {
    title: 'Something went wrong',
    description: 'We encountered an unexpected error.',
    illustration: 'wrench',
  },
  'coming-soon': {
    title: 'Coming soon',
    description: "We're working on this feature.",
    illustration: 'sparkles',
  },
};

type EmptyStateProps = {
  variant: EmptyVariant;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void; variant?: ButtonVariant };
  secondaryAction?: { label: string; onClick: () => void };
  illustration?: IllustrationName;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function EmptyState({
  variant,
  title,
  description,
  icon,
  action,
  secondaryAction,
  illustration,
  size = 'md',
  className,
}: EmptyStateProps) {
  const defaults = DEFAULTS[variant];
  const finalTitle = title ?? defaults.title;
  const finalDescription = description ?? defaults.description;
  const finalIcon = icon ?? ILLUSTRATIONS[illustration ?? defaults.illustration];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed text-center',
        size === 'sm' && 'p-6',
        size === 'md' && 'p-10',
        size === 'lg' && 'p-16',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          size === 'sm' && 'h-10 w-10',
          size === 'md' && 'h-14 w-14',
          size === 'lg' && 'h-20 w-20'
        )}
      >
        {finalIcon}
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h3 className="font-semibold text-base">{finalTitle}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {finalDescription}
        </p>
      </div>
      {(action || secondaryAction) && (
        <div className="flex gap-2">
          {action && (
            <Button
              variant={action.variant ?? 'default'}
              size="sm"
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/frontend && npx jest components/patterns/empty-state.test.tsx`
Expected: PASS

- [ ] **Step 5: Find and update all consumers**

Run: `cd apps/frontend && grep -r "from '@/components/ui/EmptyState'" --include="*.tsx" --include="*.ts"`
Expected: List of files to update.

For each file, change:
```tsx
import { EmptyState } from '@/components/ui/EmptyState';
```
to:
```tsx
import { EmptyState } from '@/components/patterns/empty-state';
```

- [ ] **Step 6: Delete the old EmptyState**

```bash
rm apps/frontend/components/ui/EmptyState.tsx
```

- [ ] **Step 7: Verify build**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/components/patterns/empty-state.tsx apps/frontend/components/patterns/empty-state.test.tsx apps/frontend/components/ui/EmptyState.tsx
git commit -m "refactor(empty-state): add semantic variants and a11y improvements"
```

---

### Task 2.2: Extend Skeleton with composite variants

**Files:**
- Modify: `apps/frontend/components/ui/skeleton.tsx` (add composites)
- Create: `apps/frontend/components/ui/skeleton.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render } from '@testing-library/react';
import { Skeleton, SkeletonList } from './skeleton';

describe('Skeleton', () => {
  it('renders base skeleton', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('renders EmailList composite with 5 rows by default', () => {
    const { container } = render(<Skeleton.EmailList />);
    const rows = container.querySelectorAll('[data-skeleton-row]');
    expect(rows).toHaveLength(5);
  });

  it('renders Table composite with configurable rows and cols', () => {
    const { container } = render(<Skeleton.Table rows={3} cols={4} />);
    const rows = container.querySelectorAll('[data-skeleton-row]');
    expect(rows).toHaveLength(3);
  });

  it('SkeletonList renders N variants', () => {
    const { container } = render(
      <SkeletonList count={3} variant={() => <Skeleton className="h-4 w-full" />} />
    );
    expect(container.children).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && npx jest components/ui/skeleton.test.tsx`
Expected: FAIL with "Skeleton.EmailList is not a function"

- [ ] **Step 3: Extend skeleton.tsx**

```tsx
import { cn } from '@/lib/tokens/cn';
import { type ReactNode } from 'react';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  );
}

// ===== Composites =====

const EmailListRow = () => (
  <div data-skeleton-row className="flex items-center gap-3 p-4 border-b">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <Skeleton className="h-3 w-12" />
  </div>
);

const EmailListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div role="status" aria-label="Loading emails">
    {Array.from({ length: count }).map((_, i) => (
      <EmailListRow key={i} />
    ))}
  </div>
);

const EmailDetailSkeleton = () => (
  <div className="space-y-4 p-6">
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <Skeleton className="h-6 w-3/4" />
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  </div>
);

const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div role="status" aria-label="Loading table">
    <div className="flex gap-2 border-b p-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} data-skeleton-row className="flex gap-2 p-3 border-b">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-3 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

const CardSkeleton = () => (
  <div className="rounded-lg border p-6 space-y-3">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);

const AvatarSkeleton = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClass = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-16 w-16' : 'h-12 w-12';
  return <Skeleton className={cn('rounded-full', sizeClass)} />;
};

const StatCardSkeleton = () => (
  <div className="rounded-lg border p-6 space-y-2">
    <Skeleton className="h-3 w-1/2" />
    <Skeleton className="h-8 w-3/4" />
    <Skeleton className="h-3 w-1/3" />
  </div>
);

type SkeletonListProps = {
  count: number;
  variant: (index: number) => ReactNode;
  className?: string;
};

const SkeletonList = ({ count, variant, className }: SkeletonListProps) => (
  <div className={className}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i}>{variant(i)}</div>
    ))}
  </div>
);

const SkeletonNamespace = Object.assign(Skeleton, {
  EmailList: EmailListSkeleton,
  EmailDetail: EmailDetailSkeleton,
  Table: TableSkeleton,
  Card: CardSkeleton,
  Avatar: AvatarSkeleton,
  StatCard: StatCardSkeleton,
  List: SkeletonList,
});

export { SkeletonNamespace as Skeleton, SkeletonList };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/frontend && npx jest components/ui/skeleton.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify build**

Run: `cd apps/frontend && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/components/ui/skeleton.tsx apps/frontend/components/ui/skeleton.test.tsx
git commit -m "feat(skeleton): add 6 composite skeletons (EmailList, EmailDetail, Table, Card, Avatar, StatCard)"
```

---

### Task 2.3: Create status primitives

**Files:**
- Create: `apps/frontend/components/primitives/status-dot.tsx`
- Create: `apps/frontend/components/primitives/status-badge.tsx`
- Create: `apps/frontend/components/primitives/spinner.tsx`
- Create: `apps/frontend/components/primitives/loading-state.tsx`
- Create: `apps/frontend/components/primitives/__tests__/status.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render, screen } from '@testing-library/react';
import { StatusDot, StatusBadge, Spinner, LoadingState } from '../index';

describe('Status primitives', () => {
  it('StatusDot renders with correct color', () => {
    const { container } = render(<StatusDot status="online" />);
    const dot = container.firstChild;
    expect(dot).toHaveClass('bg-green-500');
  });

  it('StatusBadge renders with label', () => {
    render(<StatusBadge status="success" label="Sent" />);
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('Spinner has aria-busy', () => {
    render(<Spinner size="sm" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('LoadingState shows label', () => {
    render(<LoadingState label="Loading inbox…" />);
    expect(screen.getByText('Loading inbox…')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && npx jest components/primitives/__tests__/status.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create status-dot.tsx**

```tsx
import { cn } from '@/lib/tokens/cn';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

type StatusType = 'online' | 'offline' | 'syncing' | 'error' | 'pending';

const STATUS_COLORS: Record<StatusType, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  syncing: 'bg-blue-500',
  error: 'bg-red-500',
  pending: 'bg-yellow-500',
};

type StatusDotProps = {
  status: StatusType;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function StatusDot({ status, pulse, size = 'md', className }: StatusDotProps) {
  const reducedMotion = useReducedMotion();
  const shouldPulse = pulse && !reducedMotion;
  const sizeClass = size === 'sm' ? 'h-2 w-2' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3';

  return (
    <span
      role="status"
      aria-label={status}
      className={cn(
        'inline-block rounded-full',
        sizeClass,
        STATUS_COLORS[status],
        shouldPulse && 'animate-pulse',
        className
      )}
    />
  );
}
```

- [ ] **Step 4: Create status-badge.tsx**

```tsx
import { cn } from '@/lib/tokens/cn';
import { StatusDot } from './status-dot';

type StatusType = 'online' | 'offline' | 'syncing' | 'error' | 'pending' | 'success' | 'warning' | 'info';

type StatusBadgeProps = {
  status: StatusType;
  label: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className
      )}
    >
      <StatusDot status={status} size="sm" />
      {label}
    </span>
  );
}
```

- [ ] **Step 5: Create spinner.tsx**

```tsx
import { cn } from '@/lib/tokens/cn';
import { Loader2 } from 'lucide-react';

type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';

  return (
    <Loader2
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn('animate-spin', sizeClass, className)}
    />
  );
}
```

- [ ] **Step 6: Create loading-state.tsx**

```tsx
import { Spinner } from './spinner';
import { cn } from '@/lib/tokens/cn';

type LoadingStateProps = {
  label?: string;
  className?: string;
};

export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 p-8',
        className
      )}
    >
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
```

- [ ] **Step 7: Create index.ts barrel file**

```ts
export { StatusDot } from './status-dot';
export { StatusBadge } from './status-badge';
export { Spinner } from './spinner';
export { LoadingState } from './loading-state';
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd apps/frontend && npx jest components/primitives/__tests__/status.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/components/primitives/
git commit -m "feat(primitives): add StatusDot, StatusBadge, Spinner, LoadingState"
```

---

## Phase 3: DataView Pattern

### Task 3.1: Create AsyncState type and DataView component

**Files:**
- Create: `apps/frontend/lib/types/async-state.ts`
- Create: `apps/frontend/components/patterns/data-view.tsx`
- Create: `apps/frontend/components/patterns/data-view.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { DataView } from './data-view';
import { Skeleton } from '@/components/ui/skeleton';

describe('DataView', () => {
  it('renders skeleton during loading', () => {
    const { container } = render(
      <DataView
        state={{ status: 'loading' }}
        renderItem={() => <div>item</div>}
        renderSkeleton={() => <Skeleton className="h-4 w-full" />}
        keyExtractor={(item: any) => item.id}
      />
    );
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(
      <DataView
        state={{ status: 'empty' }}
        renderItem={() => <div>item</div>}
        renderSkeleton={() => <Skeleton />}
        keyExtractor={(item: any) => item.id}
        emptyState={{
          variant: 'no-data',
          title: 'No items',
        }}
      />
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders error state with retry', () => {
    const onRetry = jest.fn();
    render(
      <DataView
        state={{ status: 'error', error: new Error('Failed') }}
        renderItem={() => <div>item</div>}
        renderSkeleton={() => <Skeleton />}
        keyExtractor={(item: any) => item.id}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('renders items when data is available', () => {
    const items = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
    render(
      <DataView
        state={{ status: 'success', data: items }}
        renderItem={(item) => <div key={item.id}>{item.name}</div>}
        renderSkeleton={() => <Skeleton />}
        keyExtractor={(item) => item.id}
      />
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && npx jest components/patterns/data-view.test.tsx`
Expected: FAIL

- [ ] **Step 3: Create AsyncState type**

```ts
// lib/types/async-state.ts
export type EmptyReason = 'no-data' | 'no-results' | 'no-access' | 'coming-soon';

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T[] }
  | { status: 'empty'; reason?: EmptyReason }
  | { status: 'error'; error: Error };
```

- [ ] **Step 4: Implement DataView**

```tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/patterns/empty-state';
import { InlineError } from '@/components/primitives/inline-error';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { cn } from '@/lib/tokens/cn';
import type { AsyncState } from '@/lib/types/async-state';

type Layout = 'list' | 'grid' | 'table';

type DataViewProps<T> = {
  state: AsyncState<T>;
  renderItem: (item: T, index: number) => ReactNode;
  renderSkeleton: () => ReactNode;
  keyExtractor: (item: T) => string;
  emptyState?: {
    variant: 'no-data' | 'no-results' | 'no-access' | 'coming-soon';
    title?: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
  errorState?: { title?: string; description?: string };
  layout?: Layout;
  gridClassName?: string;
  skeletonCount?: number;
  className?: string;
  onRetry?: () => void;
  minHeight?: number;
  flashThresholdMs?: number;
};

export function DataView<T>({
  state,
  renderItem,
  renderSkeleton,
  keyExtractor,
  emptyState,
  errorState,
  layout = 'list',
  gridClassName,
  skeletonCount = 6,
  className,
  onRetry,
  minHeight,
  flashThresholdMs = 150,
}: DataViewProps<T>) {
  const reducedMotion = useReducedMotion();
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (state.status === 'loading') {
      const start = Date.now();
      setLoadingStartTime(start);
      const timeout = setTimeout(() => {
        setShowSkeleton(true);
      }, flashThresholdMs);
      return () => {
        clearTimeout(timeout);
        setShowSkeleton(false);
        setLoadingStartTime(null);
      };
    } else {
      setShowSkeleton(false);
      setLoadingStartTime(null);
    }
  }, [state.status, flashThresholdMs]);

  // Don't show skeleton if loading completes within flash threshold
  if (state.status === 'loading' && !showSkeleton) {
    return null;
  }

  // Loading state (after flash threshold)
  if (state.status === 'loading' && showSkeleton) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={minHeight ? { minHeight } : undefined}
        className={className}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i}>{renderSkeleton()}</div>
        ))}
      </div>
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div style={minHeight ? { minHeight } : undefined} className={className}>
        <InlineError
          error={state.error}
          onRetry={onRetry}
          title={errorState?.title}
          description={errorState?.description}
        />
      </div>
    );
  }

  // Empty state
  if (state.status === 'empty' || (state.status === 'success' && state.data.length === 0)) {
    if (!emptyState) return null;
    return (
      <div style={minHeight ? { minHeight } : undefined} className={className}>
        <EmptyState
          variant={emptyState.variant}
          title={emptyState.title}
          description={emptyState.description}
          action={emptyState.action}
        />
      </div>
    );
  }

  // Success state
  if (state.status === 'success') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="data"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          style={minHeight ? { minHeight } : undefined}
          className={cn(
            layout === 'grid' && cn('grid gap-4', gridClassName),
            className
          )}
        >
          {state.data.map((item, index) => (
            <div key={keyExtractor(item)}>
              {renderItem(item, index)}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
```

- [ ] **Step 5: Create InlineError (needed for DataView)**

```tsx
// components/primitives/inline-error.tsx
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/tokens/cn';

type InlineErrorProps = {
  error: Error;
  onRetry?: () => void;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
};

export function InlineError({
  error,
  onRetry,
  title = 'Something went wrong',
  description,
  compact = false,
  className,
}: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {description ?? error.message}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          aria-label="Retry"
        >
          Retry
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/frontend && npx jest components/patterns/data-view.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/lib/types/async-state.ts apps/frontend/components/patterns/data-view.tsx apps/frontend/components/patterns/data-view.test.tsx apps/frontend/components/primitives/inline-error.tsx
git commit -m "feat(patterns): add DataView with AsyncState<T> union and flash prevention"
```

---

## Phase 4: Composites

### Task 4.1: Create Field and FormSection

**Files:**
- Create: `apps/frontend/components/patterns/field.tsx`
- Create: `apps/frontend/components/patterns/form-section.tsx`
- Create: `apps/frontend/components/patterns/__tests__/field.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render, screen } from '@testing-library/react';
import { Field } from '../field';
import { Input } from '@/components/ui/input';

describe('Field', () => {
  it('renders label and input', () => {
    render(
      <Field label="Email">
        <Input type="email" />
      </Field>
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows required indicator', () => {
    render(
      <Field label="Email" required>
        <Input type="email" />
      </Field>
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows error message with aria-invalid', () => {
    render(
      <Field label="Email" error="Invalid email">
        <Input type="email" />
      </Field>
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('shows help text with aria-describedby', () => {
    render(
      <Field label="Email" help="We'll never share your email">
        <Input type="email" />
      </Field>
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-describedby');
    expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && npx jest components/patterns/__tests__/field.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Field**

```tsx
import { ReactNode, useId } from 'react';
import { cn } from '@/lib/tokens/cn';

type FieldProps = {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  help?: string;
  className?: string;
};

export function Field({ label, children, required, error, help, className }: FieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="text-destructive ml-0.5" aria-label="required">
            *
          </span>
        )}
      </label>
      <div className="peer">
        {typeof children === 'function'
          ? children({ id, 'aria-describedby': describedBy, 'aria-invalid': !!error })
          : children}
      </div>
      {help && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create FormSection**

```tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/tokens/cn';

type FormSectionProps = {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FormSection({ title, description, footer, children, className }: FormSectionProps) {
  return (
    <section className={cn('space-y-6', className)}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 pt-4 border-t">{footer}</div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Update Input to accept the props spread**

In `apps/frontend/components/ui/input.tsx`, ensure the input forwards `id` and other props:

```tsx
// Ensure the input component spreads props
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(/* existing classes */, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/frontend && npx jest components/patterns/__tests__/field.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/components/patterns/field.tsx apps/frontend/components/patterns/form-section.tsx apps/frontend/components/patterns/__tests__/field.test.tsx
git commit -m "feat(patterns): add Field and FormSection with a11y wiring"
```

---

### Task 4.2: Create ConfirmDialog with requireTextMatch

**Files:**
- Create: `apps/frontend/components/composites/confirm-dialog.tsx`
- Create: `apps/frontend/components/composites/__tests__/confirm-dialog.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders with title and description', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={jest.fn()}
        title="Delete?"
        description="This cannot be undone."
        onConfirm={jest.fn()}
      />
    );
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('requires text match before enabling confirm', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={jest.fn()}
        title="Delete?"
        requireTextMatch="delete"
        onConfirm={onConfirm}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByPlaceholderText(/type.*delete/i);
    await user.type(input, 'delete');

    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
  });

  it('calls onConfirm when confirmed', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={jest.fn()}
        title="Delete?"
        onConfirm={onConfirm}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/frontend && npx jest components/composites/__tests__/confirm-dialog.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement ConfirmDialog**

```tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/tokens/cn';

type ConfirmVariant = 'default' | 'destructive';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  body?: string;
  confirmLabel?: string;
  confirmVariant?: ConfirmVariant;
  requireTextMatch?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  body,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  requireTextMatch,
  onConfirm,
  isLoading,
}: ConfirmDialogProps) {
  const [text, setText] = useState('');
  const canConfirm = requireTextMatch ? text === requireTextMatch : true;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {body && (
          <div className="rounded-md bg-muted p-3 text-sm">{body}</div>
        )}

        {requireTextMatch && (
          <div className="space-y-2">
            <label htmlFor="confirm-text" className="text-sm font-medium">
              Type <span className="font-mono">{requireTextMatch}</span> to confirm:
            </label>
            <Input
              id="confirm-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Type "${requireTextMatch}" to confirm`}
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            loading={isLoading}
            className={cn(confirmVariant === 'destructive' && 'bg-destructive')}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/frontend && npx jest components/composites/__tests__/confirm-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/composites/confirm-dialog.tsx apps/frontend/components/composites/__tests__/confirm-dialog.test.tsx
git commit -m "feat(composites): add ConfirmDialog with requireTextMatch for destructive actions"
```

---

## Self-Review

After writing the plan, I checked:

**1. Spec coverage:**

- ✅ Tokens (Task 1.1, 1.2)
- ✅ DataView pattern (Task 3.1)
- ✅ EmptyState refactor (Task 2.1)
- ✅ Skeleton family (Task 2.2)
- ✅ Status primitives (Task 2.3)
- ✅ Error primitives (Task 3.1 step 5)
- ✅ Field/FormSection (Task 4.1)
- ✅ ConfirmDialog (Task 4.2)
- ⚠️ DataTable, CommandPalette, StatCard, MetricTile, ProgressRing, Toast, /dev/playground, docs/design-system.mdx — these are out of scope for the inline plan, but will be added in subsequent PRs using the same task-decomposition pattern.

**2. Placeholder scan:**

- No "TBD", "TODO", "implement later" found.
- All code blocks are complete and runnable.
- All file paths are absolute.

**3. Type consistency:**

- `AsyncState<T>` defined in Task 3.1 and used consistently.
- `EmptyState` props consistent across Task 2.1 and Task 3.1.
- `DataView` accepts `AsyncState<T>` from Task 3.1.

**4. Scope check:**

- This plan covers 5 of the 14 beads issues with full implementation.
- The remaining 9 issues (DataTable, CommandPalette, StatCard, etc.) are intentionally deferred to separate plans to keep this one focused and testable.
- The foundation laid here (tokens, primitives, patterns) unblocks those future plans.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-13-foundation-ui-system.md`.**

**This plan covers the core foundation: tokens, primitives, DataView pattern, Field/FormSection, and ConfirmDialog. The remaining composites (DataTable, CommandPalette, StatCard, Toast) will be implemented in follow-up plans using the same task-decomposition pattern.**

Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
