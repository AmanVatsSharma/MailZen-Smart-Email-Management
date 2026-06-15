import { render, screen } from '@testing-library/react';
import { StatusDot, StatusBadge, Spinner, LoadingState } from '../index';

describe('Status primitives', () => {
  it('StatusDot renders with correct color', () => {
    const { container } = render(<StatusDot status="online" />);
    const dot = container.firstChild;
    expect(dot).toHaveClass('bg-green-500');
  });

  it('StatusBadge renders with label', () => {
    render(<StatusBadge status="success" label="Sent" />);
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('StatusBadge supports neutral status', () => {
    const { container } = render(<StatusBadge status="neutral" label="Draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toHaveClass('bg-gray-400');
  });

  it('Spinner has aria-busy', () => {
    render(<Spinner size="sm" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('LoadingState shows label', () => {
    render(<LoadingState label="Loading inbox…" />);
    expect(screen.getByText('Loading inbox…')).toBeInTheDocument();
  });
});