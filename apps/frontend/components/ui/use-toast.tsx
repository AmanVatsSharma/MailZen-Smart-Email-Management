'use client';

// Backward-compat shim: the original shadcn useToast used a React reducer
// + listener-array pattern. The new foundation toast system uses a
// global CustomEvent bus (see @/components/composites/toast). To avoid
// touching all 20+ feature pages in one migration, this shim re-exports
// a `useToast` whose returned `toast` function emits events the new
// <Toaster /> listens for. New code should import from
// `@/components/composites/toast` directly.

import * as React from 'react';

type Variant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'destructive';

type LegacyToastProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: Variant;
  duration?: number;
  action?:
    | React.ReactNode
    | {
        label: string;
        onClick: () => void;
      };
};

let counter = 0;
function nextId() {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `toast-${Date.now()}-${counter}`;
}

function emit(props: LegacyToastProps): {
  id: string;
  dismiss: () => void;
  update: (next: LegacyToastProps) => void;
} {
  const id = nextId();
  if (typeof window !== 'undefined') {
    const detail = {
      id,
      title: typeof props.title === 'string' ? props.title : undefined,
      description:
        typeof props.description === 'string' ? props.description : undefined,
      variant: props.variant ?? 'default',
      duration: props.duration,
      action:
        props.action && typeof props.action === 'object' && 'label' in props.action
          ? { label: props.action.label, onClick: props.action.onClick }
          : undefined,
    };
    window.dispatchEvent(new CustomEvent('mailzen:toast', { detail }));
  }
  return {
    id,
    dismiss: () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('mailzen:toast:remove', { detail: { id } })
        );
      }
    },
    update: (next: LegacyToastProps) => {
      // Updates in the legacy API replaced an existing toast. The new
      // system doesn't have stable IDs externally; the closest match
      // is dismissing the old + emitting a new one. We emit a fresh
      // toast with a new id; visual swap is the user-facing effect.
      emit(next);
    },
  };
}

function useToast() {
  // No need to subscribe to state — the new Toaster renders itself.
  return {
    toasts: [] as Array<{ id: string }>,
    toast: (props: LegacyToastProps) => emit(props),
    dismiss: (toastId?: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('mailzen:toast:remove', { detail: { id: toastId } })
        );
      }
    },
  };
}

export { useToast, toast as toastFn };
const toast = (props: LegacyToastProps) => emit(props);
export { toast };
