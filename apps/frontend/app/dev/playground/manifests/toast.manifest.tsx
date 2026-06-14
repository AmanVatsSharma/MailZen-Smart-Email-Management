'use client';

import { Toaster, useToast } from '@/components/composites/toast';
import type { ComponentManifest } from '../manifest-types';

export const toastManifest: ComponentManifest = {
  name: 'Toast',
  description: 'Notification toast system. Backed by a global event bus. Mount <Toaster /> once at app root.',
  category: 'composites',
  iconName: 'Bell',
  Preview: (props) => {
    return <ToastPreviewWrapper variant={props.variant as string | undefined} title={props.title as string} />;
  },
  controls: [
    { name: 'title', type: 'text', default: 'Email sent' },
    { name: 'variant', type: 'select', options: ['default', 'success', 'error', 'warning', 'info'], default: 'success' },
  ],
  code: `import { useToast } from '@/components/composites/toast';

const toast = useToast();
toast.\${variant}('\${title}', { description: 'Optional description' });

// In your app root:
// <Toaster />`,
};

function ToastPreviewWrapper({ variant, title }: { variant?: string; title: string }) {
  const toast = useToast();
  return (
    <>
      <button
        onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fn = (toast as any)[variant ?? 'success'];
          if (typeof fn === 'function') {
            (fn as (t: string) => void)(title);
          } else {
            toast.show(title, { variant: (variant as 'default' | 'success' | 'error' | 'warning' | 'info') ?? 'default' });
          }
        }}
        className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
      >
        Fire toast ({variant ?? 'success'})
      </button>
      <Toaster />
    </>
  );
}
