'use client';

import { DataView } from '@/components/patterns/data-view';
import { Skeleton } from '@/components/ui/skeleton';
import type { ComponentManifest } from '../manifest-types';

type Row = { id: string; name: string; email: string };

const SAMPLE_DATA: Row[] = [
  { id: '1', name: 'Aman Vats', email: 'aman@mailzen.dev' },
  { id: '2', name: 'Priya Sharma', email: 'priya@mailzen.dev' },
  { id: '3', name: 'Ravi Kumar', email: 'ravi@mailzen.dev' },
];

export const dataViewManifest: ComponentManifest = {
  name: 'DataView',
  description: 'State machine wrapper that renders loading / error / empty / success states for async data.',
  category: 'patterns',
  iconName: 'LayoutList',
  Preview: (props) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = props.status as any;
    const state =
      status === 'loading'
        ? { status: 'loading' as const }
        : status === 'error'
          ? { status: 'error' as const, error: new Error('Demo error') }
          : status === 'empty'
            ? { status: 'empty' as const }
            : { status: 'success' as const, data: SAMPLE_DATA };
    return (
      <DataView<Row>
        state={state}
        renderItem={(item) => (
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.email}</p>
          </div>
        )}
        renderSkeleton={() => <Skeleton className="h-12 w-full" />}
        keyExtractor={(item) => item.id}
        emptyState={{ variant: 'no-data', title: 'Nothing here yet' }}
        layout={props.layout as 'list' | 'grid'}
        skeletonCount={3}
      />
    );
  },
  controls: [
    { name: 'status', type: 'select', options: ['success', 'loading', 'error', 'empty'], default: 'success' },
    { name: 'layout', type: 'select', options: ['list', 'grid'], default: 'list' },
  ],
  code: `<DataView
  state={state}
  renderItem={(item) => <Row item={item} />}
  renderSkeleton={() => <Skeleton className="h-12 w-full" />}
  keyExtractor={(item) => item.id}
  layout="\${layout}"
/>`,
};
