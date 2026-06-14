'use client';

import type { ToastData, ToastVariant, ToastAction } from './toaster';

let counter = 0;
function nextId() {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `toast-${Date.now()}-${counter}`;
}

function emit(toast: Omit<ToastData, 'id'>) {
  if (typeof window === 'undefined') return '';
  const id = nextId();
  const full: ToastData = { id, ...toast };
  window.dispatchEvent(new CustomEvent<ToastData>('mailzen:toast', { detail: full }));
  return id;
}

type BaseOpts = {
  title?: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
};

function push(variant: ToastVariant) {
  return (title: string, opts: BaseOpts = {}) =>
    emit({
      title,
      description: opts.description,
      duration: opts.duration,
      action: opts.action,
      variant,
    });
}

export type ToastPromiseMessages<T> = {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((err: unknown) => string);
};

/**
 * useToast — the toast API used by feature code. Backed by a global event
 * bus (CustomEvent on `window`) so it works from anywhere in the tree
 * without prop drilling or a provider.
 */
export function useToast() {
  return {
    /** Generic/default toast */
    show: (title: string, opts: BaseOpts & { variant?: ToastVariant } = {}) =>
      emit({ title, ...opts, variant: opts.variant ?? 'default' }),
    success: push('success'),
    error: push('error'),
    warning: push('warning'),
    info: push('info'),

    /**
     * Run an async operation, surfacing a loading toast that swaps to
     * success or error based on the promise's resolution.
     */
    promise: async <T,>(p: Promise<T>, msgs: ToastPromiseMessages<T>) => {
      const id = emit({ title: msgs.loading, variant: 'info', duration: 0 });
      try {
        const data = await p;
        // Remove the loading toast
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mailzen:toast:remove', { detail: { id } }));
        }
        emit({
          title: typeof msgs.success === 'function' ? msgs.success(data) : msgs.success,
          variant: 'success',
        });
        return data;
      } catch (err) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mailzen:toast:remove', { detail: { id } }));
        }
        emit({
          title: typeof msgs.error === 'function' ? msgs.error(err) : msgs.error,
          variant: 'error',
        });
        throw err;
      }
    },
  };
}
