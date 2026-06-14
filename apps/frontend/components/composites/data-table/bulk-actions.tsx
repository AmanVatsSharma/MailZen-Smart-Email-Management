'use client';

import { Button } from '@/components/ui/button';
import type { BulkAction } from './types';

type DataTableBulkActionsProps<T> = {
  actions: BulkAction<T>[];
  selectedRows: T[];
};

export function DataTableBulkActions<T>({
  actions,
  selectedRows,
}: DataTableBulkActionsProps<T>) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-50 border border-brand-200">
      <span className="text-sm font-medium">{selectedRows.length} selected</span>
      <div className="h-4 w-px bg-brand-200" />
      {actions.map((action) => (
        <Button
          key={action.label}
          size="sm"
          variant={action.variant ?? 'ghost'}
          onClick={() => action.onClick(selectedRows)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
