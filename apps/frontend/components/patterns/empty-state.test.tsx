import { render, screen } from '@testing-library/react';
import { EmptyState } from './empty-state';
import { Mail } from 'lucide-react';

describe('EmptyState', () => {
  it('renders with semantic variant defaults', () => {
    render(<EmptyState variant="no-data" />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(
      <EmptyState
        variant="no-results"
        title="No matches"
        description="Try different keywords"
      />
    );
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.getByText('Try different keywords')).toBeInTheDocument();
  });

  it('renders action button', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        variant="no-data"
        action={{ label: 'Create', onClick }}
      />
    );
    const button = screen.getByRole('button', { name: /create/i });
    button.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('passes a11y checks', async () => {
    const { container } = render(
      <EmptyState variant="no-data" icon={<Mail aria-hidden />} />
    );
    const { axe } = await import('jest-axe');
    const results = await axe(container);
    (expect(results) as unknown as { toHaveNoViolations: () => void }).toHaveNoViolations();
  });
});
