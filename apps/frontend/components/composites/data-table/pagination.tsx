'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DataTablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
};

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: DataTablePaginationProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-muted-foreground">
        Showing <span className="font-medium">{start}</span>–
        <span className="font-medium">{end}</span> of{' '}
        <span className="font-medium">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-muted-foreground">
          Page {page} of {totalPages || 1}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
