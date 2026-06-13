import { render } from '@testing-library/react';
import { Skeleton, SkeletonList } from './skeleton';

describe('Skeleton', () => {
  it('renders base skeleton', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('renders EmailList composite with 5 rows by default', () => {
    const { container } = render(<Skeleton.EmailList />);
    const rows = container.querySelectorAll('[data-skeleton-row]');
    expect(rows).toHaveLength(5);
  });

  it('renders Table composite with configurable rows and cols', () => {
    const { container } = render(<Skeleton.Table rows={3} cols={4} />);
    const rows = container.querySelectorAll('[data-skeleton-row]');
    expect(rows).toHaveLength(3);
  });

  it('SkeletonList renders N variants', () => {
    const { container } = render(
      <SkeletonList count={3} variant={() => <Skeleton className="h-4 w-full" />} />
    );
    expect(container.children).toHaveLength(3);
  });
});
