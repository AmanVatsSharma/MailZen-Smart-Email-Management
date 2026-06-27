/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react';
import { DataView } from './data-view';
import { Skeleton } from '@/components/ui/skeleton';

describe('DataView', () => {
  it('renders skeleton during loading', async () => {
    const { container } = render(
      <DataView
        state={{ status: 'loading' }}
        renderItem={() => <div>item</div>}
        renderSkeleton={() => <Skeleton className="h-4 w-full" />}
        keyExtractor={(item: any) => item.id}
      />
    );
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')).toBeInTheDocument();
    });
  });

  it('renders empty state when no data', () => {
    render(
      <DataView
        state={{ status: 'empty' }}
        renderItem={() => <div>item</div>}
        renderSkeleton={() => <Skeleton />}
        keyExtractor={(item: any) => item.id}
        emptyState={{
          variant: 'no-data',
          title: 'No items',
        }}
      />
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders error state with retry', () => {
    const onRetry = jest.fn();
    render(
      <DataView
        state={{ status: 'error', error: new Error('Failed') }}
        renderItem={() => <div>item</div>}
        renderSkeleton={() => <Skeleton />}
        keyExtractor={(item: any) => item.id}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('renders items when data is available', () => {
    const items = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
    render(
      <DataView
        state={{ status: 'success', data: items }}
        renderItem={(item: any) => <div key={item.id}>{item.name}</div>}
        renderSkeleton={() => <Skeleton />}
        keyExtractor={(item: any) => item.id}
      />
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});
