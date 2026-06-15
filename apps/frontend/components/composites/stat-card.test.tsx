import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('renders label, value, and optional helper', () => {
    render(<StatCard label="Inbox Zero Days" value="12" helper="this quarter" />);
    expect(screen.getByText('Inbox Zero Days')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('this quarter')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<StatCard label="Inbox" value="5" icon={<Inbox data-testid="inbox-icon" />} />);
    expect(screen.getByTestId('inbox-icon')).toBeInTheDocument();
  });

  it('renders upward delta with green color and ArrowUp icon', () => {
    render(
      <StatCard
        label="Open rate"
        value="42%"
        delta={{ value: 8, trend: 'up', period: 'vs last week' }}
      />
    );
    expect(screen.getByText('vs last week')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders downward delta with red color and ArrowDown icon', () => {
    render(
      <StatCard
        label="Bounce rate"
        value="1.2%"
        delta={{ value: '0.3%', trend: 'down', period: 'vs last week' }}
      />
    );
    expect(screen.getByText('0.3%')).toBeInTheDocument();
  });

  it('renders as a button when onClick is provided', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(<StatCard label="Total emails" value="1,234" onClick={onClick} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('Total emails'));
    await user.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders as a non-interactive div when onClick is omitted', () => {
    render(<StatCard label="Total emails" value="1,234" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('interactive card has focus-visible ring classes for keyboard nav', () => {
    render(<StatCard label="Open rate" value="42%" onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/focus-visible:ring-2/);
    expect(button.className).toMatch(/focus-visible:ring-brand-500/);
  });
});
