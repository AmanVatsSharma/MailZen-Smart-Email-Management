'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/tokens/cn';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'destructive';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastData = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  /** ms. Default 5000. Use 0 for sticky. */
  duration?: number;
  action?: ToastAction;
};

const VARIANT_META: Record<ToastVariant, { Icon: React.ComponentType<{ className?: string }>; className: string; barClass: string }> = {
  default: { Icon: Info, className: 'text-foreground', barClass: 'bg-muted' },
  success: { Icon: CheckCircle2, className: 'text-success-600', barClass: 'bg-success-500' },
  error:   { Icon: AlertCircle,  className: 'text-danger-600',  barClass: 'bg-danger-500' },
  warning: { Icon: AlertTriangle,className: 'text-warning-600', barClass: 'bg-warning-500' },
  info:    { Icon: Info,         className: 'text-info-600',    barClass: 'bg-info-500' },
  destructive: { Icon: AlertCircle, className: 'text-danger-600', barClass: 'bg-danger-500' },
};

function ToastCard({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const meta = VARIANT_META[toast.variant ?? 'default'];
  const duration = toast.duration ?? 5000;

  // Auto-dismiss timer that pauses on hover
  useEffect(() => {
    if (duration <= 0 || paused) return;
    const t = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(t);
  }, [toast.id, duration, paused, onDismiss]);

  return (
    <motion.div
      layout
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.95 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 16, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'group relative w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-border-subtle bg-surface-1 shadow-lg overflow-hidden',
        'flex items-start gap-3 p-3 pe-8'
      )}
    >
      {/* Variant accent bar */}
      <div className={cn('absolute inset-y-0 start-0 w-1', meta.barClass)} aria-hidden />
      <meta.Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', meta.className)} aria-hidden />
      <div className="flex-1 min-w-0">
        {toast.title && <p className="text-sm font-medium leading-snug">{toast.title}</p>}
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{toast.description}</p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              onDismiss(toast.id);
            }}
            className="mt-1.5 text-xs font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="absolute top-2 end-2 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

/**
 * Toaster — root component. Mount once in app layout.
 * Listens to the global toast event bus (window.dispatchEvent) and renders
 * up to 5 visible toasts; oldest dismisses first.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const addHandler = (e: Event) => {
      const detail = (e as CustomEvent<ToastData>).detail;
      setToasts((curr) => [detail, ...curr].slice(0, 5));
    };
    const removeHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (!detail) return;
      // 'remove all' sentinel: detail.id === '__all__'
      if (detail.id === '__all__') {
        setToasts([]);
        return;
      }
      setToasts((curr) => curr.filter((t) => t.id !== detail.id));
    };
    window.addEventListener('mailzen:toast', addHandler);
    window.addEventListener('mailzen:toast:remove', removeHandler);
    return () => {
      window.removeEventListener('mailzen:toast', addHandler);
      window.removeEventListener('mailzen:toast:remove', removeHandler);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  };

  return (
    <div
      className="fixed bottom-4 end-4 z-toast flex flex-col-reverse gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} onDismiss={handleDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
