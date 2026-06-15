/**
 * Smoke test: verify primitives render correctly under the .dark class.
 * The actual visual quality is verified manually in the browser, but this
 * test ensures the components don't throw or produce broken markup in dark mode.
 */
import { render } from '@testing-library/react';
import { StatCard } from '@/components/composites/stat-card';
import { StatusDot, StatusBadge, Spinner, LoadingState } from '@/components/primitives';
import { EmptyState } from '@/components/patterns/empty-state';

describe('Dark mode renderability', () => {
  beforeEach(() => {
    document.documentElement.classList.add('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('StatCard renders in dark mode', () => {
    const { container } = render(
      <StatCard label="Inbox" value="42" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('StatusDot renders in dark mode', () => {
    const { container } = render(<StatusDot status="online" />);
    expect(container.firstChild).toHaveClass('bg-success-500');
  });

  it('StatusBadge renders in dark mode', () => {
    const { container } = render(<StatusBadge status="success" label="OK" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('Spinner renders in dark mode', () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('LoadingState renders in dark mode', () => {
    const { container } = render(<LoadingState label="Loading…" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('EmptyState renders in dark mode', () => {
    const { container } = render(<EmptyState variant="no-data" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
