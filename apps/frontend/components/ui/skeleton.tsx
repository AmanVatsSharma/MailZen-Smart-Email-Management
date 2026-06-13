import { cn } from '@/lib/tokens/cn';
import { type ReactNode } from 'react';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  );
}

// ===== Composites =====

const EmailListRow = () => (
  <div data-skeleton-row className="flex items-center gap-3 p-4 border-b">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <Skeleton className="h-3 w-12" />
  </div>
);

const EmailListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div role="status" aria-label="Loading emails">
    {Array.from({ length: count }).map((_, i) => (
      <EmailListRow key={i} />
    ))}
  </div>
);

const EmailDetailSkeleton = () => (
  <div className="space-y-4 p-6">
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <Skeleton className="h-6 w-3/4" />
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  </div>
);

const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div role="status" aria-label="Loading table">
    <div className="flex gap-2 border-b p-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} data-skeleton-row className="flex gap-2 p-3 border-b">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-3 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

const CardSkeleton = () => (
  <div className="rounded-lg border p-6 space-y-3">
    <Skeleton className="h-5 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);

const AvatarSkeleton = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClass = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-16 w-16' : 'h-12 w-12';
  return <Skeleton className={cn('rounded-full', sizeClass)} />;
};

const StatCardSkeleton = () => (
  <div className="rounded-lg border p-6 space-y-2">
    <Skeleton className="h-3 w-1/2" />
    <Skeleton className="h-8 w-3/4" />
    <Skeleton className="h-3 w-1/3" />
  </div>
);

type SkeletonListProps = {
  count: number;
  variant: (index: number) => ReactNode;
  className?: string;
};

const SkeletonList = ({ count, variant, className }: SkeletonListProps) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={className}>{variant(i)}</div>
    ))}
  </>
);

const SkeletonNamespace = Object.assign(Skeleton, {
  EmailList: EmailListSkeleton,
  EmailDetail: EmailDetailSkeleton,
  Table: TableSkeleton,
  Card: CardSkeleton,
  Avatar: AvatarSkeleton,
  StatCard: StatCardSkeleton,
  List: SkeletonList,
});

export { SkeletonNamespace as Skeleton, SkeletonList };
