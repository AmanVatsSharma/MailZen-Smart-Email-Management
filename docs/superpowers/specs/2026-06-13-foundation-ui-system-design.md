# MailZen Foundation UI System — Design Spec

**Date:** 2026-06-13
**Status:** Approved (pending user review of written spec)
**Phase:** Foundation (Phase 1 of N)
**Scope:** Tokens, state primitives, and 5-7 high-leverage composites. NOT a full design system.

---

## 1. Goals & Non-Goals

### Goals

1. **Make async states a first-class concern.** Every list, table, and detail view composes a `DataView` pattern. Loading/empty/error are no longer afterthoughts.
2. **Eliminate duplication.** Today, `EmailListSkeleton`, billing skeletons, contact list skeletons, automation list skeletons all reinvent the same visual. One primitive, many compositions.
3. **Standardize tokens.** Colors, type, motion, elevation, spacing, z-index — all accessible from one place, both as CSS variables (for Tailwind v4) and as a TypeScript API (for chart libs, JSX inline styles, etc.).
4. **Ship composable composites.** DataTable, CommandPalette, StatCard, Toast refactor, ConfirmDialog, Field-based forms — the surfaces used in 80% of MailZen pages.
5. **Document it in the repo, not a wiki.** `/dev/playground` + `docs/design-system.mdx` live with the code.

### Non-Goals (deferred to Phase 2+)

- Migrating existing HSL tokens to OKLCH (we add OKLCH alongside — no regression risk in this phase)
- Storybook / Chromatic visual regression
- Right-to-left (RTL) layout support
- Internationalization of docs
- Figma Code Connect sync
- Component-level analytics (PostHog events)
- Adding new animation libraries (we keep Framer Motion only)

### Success Criteria

- Every new list/table/detail surface uses `DataView` (or justifies why not)
- 80%+ reduction in ad-hoc skeleton components across the app
- A new engineer can build a settings page from the docs alone in <30 minutes
- All primitives pass `jest-axe` a11y tests
- `/dev/playground` renders 100% of primitives and composites
- Bundle size impact <20KB gzipped (excluding the optional TanStack Table for `DataTable`)

---

## 2. Architecture & File Layout

```
apps/frontend/
  app/
    globals.css                    # @theme block, fluid type scale, motion tokens
    (dashboard)/                   # existing
    dev/
      playground/                  # NEW: /dev/playground
        page.tsx
        _components/                # nav, prop controls, code snippet
        manifests/                   # one manifest per component
  components/
    ui/                             # existing shadcn primitives (refined, not rewritten)
    primitives/                     # NEW: our atoms
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
    patterns/                       # NEW: composition patterns
      data-view.tsx
      form-section.tsx
      field.tsx
      empty-state.tsx               # replaces existing
    composites/                     # NEW: feature-aware composites
      data-table/
        index.tsx
        toolbar.tsx
        pagination.tsx
        bulk-actions.tsx
        types.ts
      command-palette.tsx           # refactor existing
      stat-card.tsx
      metric-tile.tsx
      progress-ring.tsx
      confirm-dialog.tsx
      toast/
        index.tsx                   # refined useToast hook
        toaster.tsx                 # refined <Toaster> root
        types.ts                    # AsyncState, toast variants, options
    feedback/                       # NEW
      alert.tsx
      banner.tsx
  lib/
    tokens/
      cn.ts                         # moved from utils.ts
      colors.ts                     # TS API over CSS variables
      motion.ts                     # central Framer Motion variants
      typography.ts                 # fluid type scale
      elevation.ts                  # box-shadow tokens
      spacing.ts
      z-index.ts
    hooks/
      useReducedMotion.ts
      useDelayedRender.ts
      useIsMobile.ts
      useFocusTrap.ts               # for our own dialogs (Radix handles this, but keep around)
      useToast.ts                   # re-export from composites/toast
  styles/
    tokens.css                      # @theme block (extracted from globals.css)
    typography.css                  # fluid type scale
  docs/
    design-system.mdx               # written spec, examples, copy-paste
```

### Architectural Decisions

- **Three-tier taxonomy:** `ui/` (vendored, low churn) → `primitives/` (our atoms, medium churn) → `composites/` (feature-aware, higher churn). Easy to reason about where a new component lives.
- **Tokens as single source of truth:** CSS variables in `globals.css` are the runtime values Tailwind v4 picks up; `lib/tokens/*.ts` exposes the same values to JS. No string duplication. The TS API is intentionally a thin re-export: `import { brand, surface, status } from '@/lib/tokens/colors';` returns the literal `var(--color-brand-500)` strings, so they're safe to use in `style={{}}` and to pass to chart libraries without re-deriving the color from the variable name.
- **One playground, not Storybook:** `/dev/playground` is a Next.js route with live prop controls. Zero extra deps, ships with the app, gated on `NODE_ENV !== 'production'`.
- **State as a typed union:** `AsyncState<T>` is an explicit discriminated union. No `undefined` checks scattered; one `switch` in `DataView`.

---

## 3. Tokens & Theming

### 3.1 Color tokens (`app/globals.css` @theme block)

Existing HSL variables stay as runtime values. New layer is a **semantic naming layer** mapped on top using OKLCH (perceptually uniform, better dark-mode luminance control):

```css
@theme {
  /* ===== Brand ===== */
  --color-brand-50:  oklch(0.97 0.02 290);
  --color-brand-100: oklch(0.94 0.05 290);
  --color-brand-200: oklch(0.88 0.09 290);
  --color-brand-300: oklch(0.80 0.14 290);
  --color-brand-400: oklch(0.72 0.19 290);
  --color-brand-500: oklch(0.62 0.24 290);  /* default primary */
  --color-brand-600: oklch(0.55 0.25 290);
  --color-brand-700: oklch(0.46 0.22 290);
  --color-brand-800: oklch(0.38 0.18 290);
  --color-brand-900: oklch(0.30 0.13 290);

  /* ===== Semantic surface ===== */
  --color-surface-0: oklch(0.99 0.005 250);   /* page bg light */
  --color-surface-1: oklch(1 0 0);            /* card bg */
  --color-surface-2: oklch(0.97 0.008 250);   /* nested */
  --color-surface-3: oklch(0.95 0.01 250);    /* hover */
  --color-surface-inverse: oklch(0.18 0.02 250);

  /* ===== Status (success, warning, danger, info) ===== */
  /* Each gets 50..900 ramps following the same OKLCH lightness curve as brand */
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
}

.dark {
  /* dark overrides for surface-0..3, brand-400..500, border-* */
}
```

**Status ramp values** follow the same OKLCH lightness curve as the brand ramp so they feel visually consistent. Phase 1 only commits to `*-500` (the default) for each status color; `*-50` through `*-900` ramps are added in Phase 2 if needed.

### 3.2 Fluid type scale (`styles/typography.css`)

```css
:root {
  /* Modular scale, ratio 1.2, fluid via clamp(min, vw-based, max) */
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

These are exposed as `text-fs-xs`, `text-fs-base`, etc. via the @theme block.

### 3.3 Motion tokens (`lib/tokens/motion.ts`)

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
    out:           [0, 0, 0.2, 1] as const,         // default enter
    in:            [0.4, 0, 1, 1] as const,         // default exit
    inOut:         [0.4, 0, 0.2, 1] as const,       // layout shifts
    spring:        { type: 'spring' as const, stiffness: 400, damping: 30 },
    springBouncy:  { type: 'spring' as const, stiffness: 600, damping: 20 },
  },
  variants: {
    fadeIn:        { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
    slideUp:       { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } },
    slideInRight:  { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 16 } },
    scaleIn:       { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } },
  },
  stagger: (delay = 0.05) => ({
    animate: { transition: { staggerChildren: delay } },
  }),
  reducedMotion: { duration: 0, transition: { duration: 0 } },
} as const;
```

`useReducedMotion()` hook returns `true` when the user has `prefers-reduced-motion: reduce` set; animations swap to `reducedMotion` automatically. All motion-consuming components MUST respect this.

### 3.4 Elevation tokens (`styles/tokens.css`)

```css
:root {
  --shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.04);
  --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.08), 0 1px 2px -1px oklch(0 0 0 / 0.06);
  --shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.10), 0 2px 4px -2px oklch(0 0 0 / 0.06);
  --shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.10), 0 4px 6px -4px oklch(0 0 0 / 0.05);
  --shadow-xl: 0 20px 25px -5px oklch(0 0 0 / 0.12), 0 8px 10px -6px oklch(0 0 0 / 0.05);
  --shadow-glow: 0 0 0 1px var(--color-ring), 0 0 20px -2px var(--color-ring);
}
```

### 3.5 Spacing, radius, z-index

```css
@theme {
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;       /* current default */
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;
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
```

The z-index scale fixes a real production bug: today, dropdowns sometimes appear behind modals and toasts above dialogs. Centralized scale prevents future collisions.

---

## 4. Core Primitives & State System

### 4.1 `DataView` pattern — single source of truth for async surfaces

```ts
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T[] }
  | { status: 'empty'; reason?: EmptyReason }
  | { status: 'error'; error: Error };

type EmptyReason = 'no-data' | 'no-results' | 'no-access' | 'coming-soon';

type DataViewProps<T> = {
  state: AsyncState<T>;
  renderItem: (item: T, index: number) => ReactNode;
  renderSkeleton: () => ReactNode;
  keyExtractor: (item: T) => string;
  emptyState?: EmptyStateConfig;
  errorState?: { title?: string; description?: string };
  layout?: 'list' | 'grid' | 'table';
  gridClassName?: string;
  skeletonCount?: number;          // default 6
  className?: string;
  onRetry?: () => void;
  minHeight?: number;              // prevents layout shift
  // Flash prevention
  flashThresholdMs?: number;       // default 150 — show skeleton only if loading exceeds this
};
```

`DataView`:
- Renders `renderSkeleton()` `skeletonCount` times during `loading`.
- If `loading` resolves in <`flashThresholdMs`, skips the skeleton render entirely (no flash).
- If `loading` persists >`flashThresholdMs`, cross-fades to skeleton.
- Delegates empty/error UI to `EmptyState` / `InlineError` with a retry hook.
- Respects `useReducedMotion()` (no cross-fade when reduced).

### 4.2 `EmptyState` (refactor) — semantic variants

```ts
type EmptyVariant = 'no-data' | 'no-results' | 'no-access' | 'error' | 'coming-soon';

type EmptyStateProps = {
  variant: EmptyVariant;        // drives default icon + copy
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void; variant?: ButtonVariant };
  secondaryAction?: { label: string; onClick: () => void };
  illustration?: 'search' | 'inbox' | 'lock' | 'wrench' | 'sparkles';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};
```

The `illustration` prop uses inline SVG (no asset pipeline) for 5 standard illustrations. Inline SVG keeps the bundle small and themable via `currentColor`.

### 4.3 `Skeleton` family

```tsx
// base
<Skeleton className="h-4 w-32" />   // existing, keep

// composites
<Skeleton.EmailList count={8} />
<Skeleton.EmailDetail />
<Skeleton.Table rows={5} cols={4} />
<Skeleton.Card />
<Skeleton.Avatar size="lg" />
<Skeleton.StatCard />

// generic
<SkeletonList count={5} variant={(i) => <Skeleton.Card />}>
```

Each composite is a regular React component (not a styled-config thing). Composable, testable, readable.

### 4.4 Status primitives

```tsx
<StatusDot status="online" />            // 8px colored dot
<StatusDot status="syncing" pulse />     // animated
<StatusBadge status="success" label="Sent" />
<Spinner size="sm" />                    // inline button loader
<LoadingState label="Loading inbox…" /> // full-area branded loader
```

### 4.5 Error primitives

```tsx
<InlineError error={error} onRetry={refetch} compact />      // form field error
<ErrorBanner error={error} onRetry={refetch} dismissible />  // top of page
<ErrorFallback scope="email-list" />                          // ErrorBoundary scope tag for Sentry
```

### 4.6 Why this matters

Before this phase:
- `EmailList.tsx` has its own skeleton (`EmailListSkeleton.tsx`).
- `contacts/`, `billing/`, `automations/` each reinvent the same loading/empty/error UI.
- Changing the visual language touches 15+ files.

After this phase:
- Every list/table uses `DataView`.
- Change visual language once in `DataView`, propagates everywhere.
- New surfaces are 80% smaller: just supply `renderItem`.

---

## 5. Composites, Forms, Docs & Playground

### 5.1 `DataTable` — production-grade table

Built on **TanStack Table** (headless, ~12KB gzipped). We own the JSX.

```ts
type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  selection?: 'single' | 'multi';
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  // pick ONE:
  pagination?: { pageSize: number; page: number; onPageChange: (p: number) => void };
  infiniteScroll?: { hasMore: boolean; onLoadMore: () => void };
  virtualScroll?: boolean;       // for 10k+ rows
  // states delegate to DataView
  state: AsyncState<T>;
  onRetry?: () => void;
  bulkActions?: BulkAction<T>[];
  toolbar?: {
    search?: { value: string; onChange: (v: string) => void; placeholder?: string };
    filters?: FilterChip[];
    actions?: ReactNode;
  };
  emptyState?: EmptyStateConfig;
  onRowClick?: (row: T) => void;
  getRowId: (row: T) => string;
  density?: 'compact' | 'comfortable';
  stickyHeader?: boolean;
  className?: string;
};
```

State handling is delegated to `DataView`. Selection, sorting, and pagination live in TanStack; we own the toolbar/pagination/empty-state JSX.

### 5.2 `CommandPalette` — keyboard-first command surface

Refactor of existing `components/ui/command-palette.tsx`.

```ts
type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroup[];
  hotkey?: string;            // default 'mod+k'
  emptyState?: { title: string; hint?: string };
  asyncSearch?: {
    query: string;
    onQuery: (q: string) => Promise<CommandItem[]>;
    debounceMs?: number;      // default 200
  };
  placeholder?: string;
};
```

`★ Insight ─────────────────────────────────────`
- TanStack Table is headless: it gives you the sorting/selection/pagination state machine, you give it the JSX. We use it because building all that state from scratch is a 2-week rabbit hole.
- The toolbar pattern (search + filters + actions) is the most common UI in admin tables. Baking it into the component means the 4th time someone needs a table, they're not copy-pasting toolbar code.
- The `state` prop accepting `AsyncState<T>` means the table itself doesn't know about Apollo, React Query, or fetch. The data layer stays swappable.
`─────────────────────────────────────────────────`

### 5.3 Data viz atoms

```tsx
<StatCard
  label="Inbox Zero Days"
  value="12"
  delta={{ value: 8, trend: 'up', period: 'vs last week' }}
  icon={<InboxIcon />}
  onClick={() => navigate('/analytics/inbox')}
/>

<MetricTile
  label="Storage Used"
  value="4.2 GB"
  total="15 GB"
  progress={0.28}
  trend="up"
/>

<ProgressRing value={75} size={64} strokeWidth={6} />
```

### 5.4 `Toast` refinement

Refactor of existing `use-toast.tsx` and `toaster.tsx`.

```ts
const toast = useToast();

toast.success('Email sent', {
  description: 'Delivered to 3 recipients',
  action: { label: 'Undo', onClick: undo },
});
toast.error('Sync failed', { duration: 0 /* sticky */ });
toast.promise(sendEmail(), {
  loading: 'Sending…', success: 'Sent!', error: 'Failed',
});
toast.custom(<EmailDraftToast draft={draft} />);
```

Stacking: max 5 visible, oldest dismisses first. Pause on hover. Respects `prefers-reduced-motion`.

### 5.5 `ConfirmDialog` — destructive actions

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Delete automation?"
  description="This will stop running on 14 active inboxes."
  body="Once deleted, automations cannot be recovered."
  confirmLabel="Delete automation"
  confirmVariant="destructive"
  requireTextMatch="delete"   // type-to-confirm for high-stakes
  onConfirm={handleDelete}
  isLoading={isDeleting}
/>
```

`requireTextMatch` is the production-grade detail most apps miss. Critical destructive actions require the user to type a specific word before the confirm button enables.

### 5.6 Form system: `Field`, `FormSection`, refactored form.tsx

```tsx
<FormSection
  title="Workspace details"
  description="How your team appears in MailZen."
  footer={
    <>
      <Button variant="ghost">Cancel</Button>
      <Button type="submit" loading={isSubmitting}>Save</Button>
    </>
  }
>
  <Field label="Workspace name" required error={errors.name}>
    <Input {...register('name')} />
  </Field>
  <Field label="Slug" help="Used in your workspace URL" error={errors.slug}>
    <Input {...register('slug')} prefix="mailzen.app/" />
  </Field>
</FormSection>
```

`Field` is the missing atom — it owns label + help text + error message + required indicator + accessibility wiring (aria-describedby, aria-invalid). Every form input in the app uses it.

### 5.7 `/dev/playground` route

A Next.js App Router page at `app/dev/playground/page.tsx`. Not Storybook. A single page:

- Left sidebar: component tree (Button, DataTable, EmptyState, etc.)
- Main area: live preview
- Right sidebar: prop controls (text, select, toggle) generated from a manifest
- Bottom: code snippet with copy button (formatted with shiki)

Manifest example:

```ts
const buttonManifest: ComponentManifest = {
  name: 'Button',
  component: Button,
  variants: [
    { name: 'variant', type: 'select', options: ['default', 'destructive', 'outline', 'ghost', 'link'], default: 'default' },
    { name: 'size', type: 'select', options: ['sm', 'default', 'lg', 'icon'], default: 'default' },
    { name: 'disabled', type: 'boolean', default: false },
    { name: 'asChild', type: 'boolean', default: false },
  ],
  examples: [
    { title: 'With icon', code: '<Button><MailIcon /> Send email</Button>' },
  ],
};
```

Gated on `process.env.NODE_ENV !== 'production'`. Lives in `app/dev/`, never deployed.

### 5.8 MDX docs site — `docs/design-system.mdx`

Single document (we can split later). Sections:
1. **Principles** — accessibility-first, state-aware, composable, predictable.
2. **Tokens** — color/type/motion/elevation tables with copy-paste CSS.
3. **Primitives** — Button, Card, Badge, Avatar — props + 1-2 examples.
4. **Patterns** — DataView, FormSection, EmptyState variants.
5. **Composites** — DataTable, CommandPalette, StatCard.
6. **Recipes** — "Build a settings page," "Build a billing summary," "Build an empty inbox."
7. **Accessibility** — focus order, screen reader notes, keyboard map.
8. **Do / Don't** — common anti-patterns with code.

Source of truth for the design system, versioned with the code.

### 5.9 Tests

- **Unit tests:** every primitive + composite has at least 1 happy-path test + 1 a11y test (`jest-axe`).
- **Visual:** skip Storybook snapshots; rely on `/dev/playground` for visual review. (Chromatic is a Phase 2 decision.)
- **E2E:** the `/dev/playground` route itself has 1 Playwright test that loads and renders 5 component previews.

---

## 6. Phased Delivery Plan

This spec is **Phase 1 (Foundation)**. Subsequent phases are sketched below for context but not part of this implementation.

### Phase 1: Foundation (this spec)

1. Token system (colors, type, motion, elevation, spacing, z-index)
2. `DataView` pattern + `AsyncState<T>` type
3. `EmptyState` refactor + variants
4. `Skeleton` family (base + 6 composites)
5. Status primitives (`StatusDot`, `StatusBadge`, `Spinner`, `LoadingState`)
6. Error primitives (`InlineError`, `ErrorBanner`, `ErrorFallback`)
7. `Field`, `FormSection` form atoms
8. `DataTable` (TanStack-powered)
9. `CommandPalette` refactor
10. `StatCard`, `MetricTile`, `ProgressRing`
11. `Toast` refinement
12. `ConfirmDialog` with `requireTextMatch`
13. `/dev/playground` route + 12 component manifests
14. `docs/design-system.mdx` (single document, 8 sections)

### Phase 2 (deferred)

- HSL → OKLCH full migration
- Storybook / Chromatic visual regression
- Figma Code Connect sync
- Component analytics (PostHog)
- More components: `DateRangePicker`, `RichTextEditor` wrapper, `FileUpload`, etc.

### Phase 3 (deferred)

- RTL support
- Component-level i18n for docs
- Theming: user-customizable accent colors

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Visual regression from OKLCH brand tokens | New layer is parallel; existing HSL vars untouched. New components opt in. |
| `DataView` flash threshold misconfigured (too long = feels slow, too short = flashes) | Default 150ms is research-backed; tunable per consumer. Logged in console in dev. |
| TanStack Table bundle cost (~12KB gz) | Already small; not a concern at MailZen's scale. Code-split DataTable route if needed. |
| `/dev/playground` accidentally ships to prod | Hard gate on `NODE_ENV !== 'production'` AND no export from `app/dev/` other than the playground route. |
| Existing components feel "old" relative to new ones | We refine in place where it matters (`EmptyState`, `Skeleton`, `Toast`, `CommandPalette`). We do not rewrite `Button`, `Card`, `Badge`, `Dialog` — they are already good. |
| Use of `motion.button` in `Button` may cause hydration issues with React 19 / RSC | Existing implementation already works; we leave it alone. Document gotcha in code comments. |

---

## 8. Out of Scope (Explicit)

To be explicit about what this spec does NOT cover:
- Migrating existing HSL tokens to OKLCH (we add OKLCH alongside)
- Storybook / Chromatic visual regression
- Right-to-left (RTL) layout
- Internationalization of the docs
- A Figma library sync (Code Connect)
- Component-level analytics (PostHog events)
- Adding new animation libraries
- New shadcn primitives (we refine the existing set; we don't add `Combobox`, `Carousel`, `NavigationMenu`, etc. in this phase)

---

## 9. Open Questions for Implementation

1. **TanStack Table is the right choice?** — Headless, ~12KB, MIT, well-maintained. Alternative: build our own. Recommendation: TanStack.
2. **`/dev/playground` vs Storybook?** — Recommendation: in-app route. Cheaper, no extra build, ships with the app.
3. **MDX in `/docs` or in `app/dev/playground`?** — Recommendation: separate `docs/design-system.mdx` file in repo root, rendered by Next.js when the user navigates to `/dev/docs` (no separate docs site, no MDX server).
4. **Do we deprecate the existing `EmailListSkeleton` immediately or migrate gradually?** — Recommendation: keep both during transition; deprecate with a console warning; remove in Phase 2.

These are resolved at the planning stage, not blocking this spec.
