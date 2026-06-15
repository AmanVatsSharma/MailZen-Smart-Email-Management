import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders with title, description, and action buttons', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete item?"
        description="This cannot be undone."
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete?"
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('requires text match when requireTextMatch is set', async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete workspace"
        requireTextMatch="delete"
        onConfirm={onConfirm}
      />
    );
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByRole('textbox');
    await user.type(input, 'wrong');
    expect(confirmBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'delete');
    expect(confirmBtn).toBeEnabled();
  });

  it('accepts ReactNode description (JSX with formatting)', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete contact?"
        description={
          <>
            <strong>Alice</strong> (alice@example.com) will be permanently removed.
          </>
        }
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('(alice@example.com) will be permanently removed.')).toBeInTheDocument();
  });
});
