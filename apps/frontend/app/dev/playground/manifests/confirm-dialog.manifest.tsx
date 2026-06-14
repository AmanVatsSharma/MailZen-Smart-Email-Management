'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/composites/confirm-dialog';
import type { ComponentManifest } from '../manifest-types';

export const confirmDialogManifest: ComponentManifest = {
  name: 'ConfirmDialog',
  description: 'Destructive-action confirmation modal. Supports typed-confirmation and loading state.',
  category: 'composites',
  iconName: 'AlertTriangle',
  Preview: (props) => {
    return (
      <ConfirmPreviewWrapper
        title={props.title as string}
        description={props.description as string | undefined}
        variant={props.variant === 'destructive' ? 'destructive' : 'default'}
        requireTextMatch={props.requireText as string | undefined}
        confirmLabel={props.confirmLabel as string | undefined}
      />
    );
  },
  controls: [
    { name: 'title', type: 'text', default: 'Delete this draft?' },
    { name: 'description', type: 'text', default: 'This action cannot be undone.' },
    { name: 'variant', type: 'select', options: ['default', 'destructive'], default: 'destructive' },
    { name: 'confirmLabel', type: 'text', default: 'Delete' },
    { name: 'requireText', type: 'text', default: 'delete' },
  ],
  code: `<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="\${title}"
  description="\${description}"
  confirmLabel="\${confirmLabel}"
  variant="\${variant}"
  requireTextMatch="\${requireText}"
  onConfirm={handleConfirm}
/>`,
};

function ConfirmPreviewWrapper({
  title,
  description,
  variant,
  requireTextMatch,
  confirmLabel,
}: {
  title: string;
  description?: string;
  variant: 'default' | 'destructive';
  requireTextMatch?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border-subtle bg-surface-1 px-4 py-2 text-sm hover:bg-surface-2"
      >
        Open confirm dialog
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        variant={variant}
        requireTextMatch={requireTextMatch || undefined}
        confirmLabel={confirmLabel}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}
