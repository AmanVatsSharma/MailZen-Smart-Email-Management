import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, type CommandGroup } from './command-palette';
import { Inbox, Settings, Mail } from 'lucide-react';

const groups: CommandGroup[] = [
  {
    id: 'navigation',
    label: 'Navigation',
    items: [
      { id: 'inbox', label: 'Go to inbox', icon: <Inbox />, onSelect: jest.fn() },
      { id: 'settings', label: 'Open settings', icon: <Settings />, onSelect: jest.fn() },
    ],
  },
  {
    id: 'compose',
    label: 'Compose',
    items: [
      { id: 'new-email', label: 'New email', icon: <Mail />, shortcut: 'C', onSelect: jest.fn() },
    ],
  },
];

describe('CommandPalette', () => {
  it('renders all groups and items when open', () => {
    render(
      <CommandPalette open onOpenChange={jest.fn()} groups={groups} />
    );
    expect(screen.getByText('Go to inbox')).toBeInTheDocument();
    expect(screen.getByText('Open settings')).toBeInTheDocument();
    expect(screen.getByText('New email')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Compose')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <CommandPalette open={false} onOpenChange={jest.fn()} groups={groups} />
    );
    expect(screen.queryByText('Go to inbox')).not.toBeInTheDocument();
  });

  it('filters items by query', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette open onOpenChange={jest.fn()} groups={groups} />
    );
    const input = screen.getByPlaceholderText(/Type a command/i);
    await user.type(input, 'inbox');
    expect(screen.getByText('Go to inbox')).toBeInTheDocument();
    expect(screen.queryByText('New email')).not.toBeInTheDocument();
  });

  it('calls onSelect and closes when item is clicked', async () => {
    const onSelect = jest.fn();
    const onOpenChange = jest.fn();
    const user = userEvent.setup();
    const localGroups: CommandGroup[] = [
      { id: 'g1', label: 'G1', items: [{ id: 'i1', label: 'Click me', onSelect }] },
    ];
    render(
      <CommandPalette open onOpenChange={onOpenChange} groups={localGroups} />
    );
    await user.click(screen.getByText('Click me'));
    expect(onSelect).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows empty state when no results', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        open
        onOpenChange={jest.fn()}
        groups={groups}
        emptyState={{ title: 'No matches', hint: 'Try another search' }}
      />
    );
    await user.type(screen.getByPlaceholderText(/Type a command/i), 'xyzzy');
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.getByText('Try another search')).toBeInTheDocument();
  });

  it('keyboard navigation with ArrowDown/ArrowUp/Enter', async () => {
    const onSelect = jest.fn();
    const onOpenChange = jest.fn();
    const user = userEvent.setup();
    const localGroups: CommandGroup[] = [
      {
        id: 'g1',
        label: 'G1',
        items: [
          { id: 'i1', label: 'First', onSelect: jest.fn() },
          { id: 'i2', label: 'Second', onSelect },
        ],
      },
    ];
    render(
      <CommandPalette open onOpenChange={onOpenChange} groups={localGroups} />
    );
    const input = screen.getByPlaceholderText(/Type a command/i);
    input.focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
