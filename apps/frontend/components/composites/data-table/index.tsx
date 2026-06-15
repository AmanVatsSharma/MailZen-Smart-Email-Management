'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import { DataView } from '@/components/patterns/data-view';
import { EmptyState } from '@/components/patterns/empty-state';
import { cn } from '@/lib/tokens/cn';
import type { DataTableProps } from './types';
import { DataTableToolbar } from './toolbar';
import { DataTablePagination } from './pagination';
import { DataTableBulkActions } from './bulk-actions';

export type { DataTableProps, BulkAction, FilterChip } from './types';

export function DataTable<T>({
  data,
  columns,
  selection,
  selectedIds,
  onSelectionChange,
  sorting,
  onSortingChange,
  pagination,
  infiniteScroll,
  state,
  onRetry,
  bulkActions = [],
  toolbar,
  emptyState,
  onRowClick,
  getRowId,
  density = 'comfortable',
  stickyHeader = false,
  className,
}: DataTableProps<T>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Convert selectedIds array to rowSelection map for TanStack
  const controlledRowSelection: RowSelectionState = selectedIds
    ? Object.fromEntries(selectedIds.map((id) => [id, true]))
    : rowSelection;

  const handleRowSelectionChange = (
    updaterOrValue: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)
  ) => {
    const newValue =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(controlledRowSelection)
        : updaterOrValue;
    setRowSelection(newValue);
    onSelectionChange?.(Object.keys(newValue).filter((k) => newValue[k]));
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection: controlledRowSelection,
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting ?? []) : updater;
      onSortingChange?.(newSorting);
    },
    onRowSelectionChange: selection ? handleRowSelectionChange : undefined,
    enableRowSelection: !!selection,
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: !!pagination,
    manualSorting: !!onSortingChange,
  });

  const isLoading = state.status === 'loading' || state.status === 'idle';
  const isEmpty = state.status === 'empty';

  if (isLoading) {
    return (
      <DataView
        state={state}
        renderItem={() => null}
        renderSkeleton={() => (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )}
        keyExtractor={(item: T) => getRowId(item)}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        variant={emptyState?.variant ?? 'no-data'}
        title={emptyState?.title}
        description={emptyState?.description}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <DataView
        state={state}
        renderItem={() => null}
        renderSkeleton={() => null}
        keyExtractor={(item: T) => getRowId(item)}
        onRetry={onRetry}
      />
    );
  }

  const rows = table.getRowModel().rows;
  const selectedRows = rows
    .filter((row) => controlledRowSelection[row.id])
    .map((row) => row.original);

  return (
    <div className={cn('space-y-3', className)}>
      {(toolbar || bulkActions.length > 0) && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {toolbar && <DataTableToolbar toolbar={toolbar} />}
          {bulkActions.length > 0 && selectedRows.length > 0 && (
            <DataTableBulkActions actions={bulkActions} selectedRows={selectedRows} />
          )}
        </div>
      )}

      <div
        className={cn(
          'rounded-md border border-border-subtle overflow-auto',
          stickyHeader && 'max-h-[600px]'
        )}
      >
        <table className="w-full caption-bottom text-sm">
          <thead
            className={cn(stickyHeader && 'sticky top-0 bg-surface-1 z-sticky')}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'text-start font-medium text-muted-foreground',
                      density === 'compact' ? 'h-8 px-2' : 'h-10 px-3'
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  'border-b transition-colors hover:bg-surface-2',
                  onRowClick && 'cursor-pointer',
                  controlledRowSelection[row.id] && 'bg-brand-50'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn(density === 'compact' ? 'p-2' : 'p-3')}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <DataTablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          total={data.length}
        />
      )}

      {infiniteScroll && infiniteScroll.hasMore && (
        <div className="text-center py-4">
          <button
            onClick={infiniteScroll.onLoadMore}
            className="text-sm text-brand-600 hover:underline"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
