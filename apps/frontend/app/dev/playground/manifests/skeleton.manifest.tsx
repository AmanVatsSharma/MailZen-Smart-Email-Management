import { Skeleton } from '@/components/ui/skeleton';
import type { ComponentManifest } from '../manifest-types';

export const skeletonManifest: ComponentManifest = {
  name: 'Skeleton',
  description: 'Animated placeholder block for loading states. Multiple composite variants (EmailList, Card, etc.) are also exported.',
  category: 'primitives',
  iconName: 'Loader',
  Preview: (props) => {
    const count = Number(props.count ?? 1);
    return (
      <div className="space-y-2 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  },
  controls: [
    { name: 'rows', type: 'number', default: 4, min: 1, max: 12 },
  ],
  code: `<Skeleton className="h-4 w-full" />`,
};
