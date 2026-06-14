import type { ColumnDef, SortingState } from '@tanstack/react-table';
import type { AsyncState } from '@/lib/types/async-state';
import type { ReactNode } from 'react';

export type BulkAction<T> = {
  label: string;
  onClick: (selectedRows: T[]) => void;
  variant?: 'default' | 'destructive';
};

export type FilterChip = {
  id: string;
  label: string;
  active: boolean;
  onToggle: () => void;
};

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  selection?: 'single' | 'multi';
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  // Pick ONE:
  pagination?: {
    pageSize: number;
    page: number;
    onPageChange: (p: number) => void;
  };
  infiniteScroll?: {
    hasMore: boolean;
    onLoadMore: () => void;
  };
  // States delegate to DataView
  state: AsyncState<T>;
  onRetry?: () => void;
  bulkActions?: BulkAction<T>[];
  toolbar?: {
    search?: {
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
    };
    filters?: FilterChip[];
    actions?: ReactNode;
  };
  emptyState?: {
    variant?: 'no-data' | 'no-results' | 'no-access' | 'coming-soon';
    title?: string;
    description?: string;
  };
  onRowClick?: (row: T) => void;
  getRowId: (row: T) => string;
  density?: 'compact' | 'comfortable';
  stickyHeader?: boolean;
  className?: string;
};