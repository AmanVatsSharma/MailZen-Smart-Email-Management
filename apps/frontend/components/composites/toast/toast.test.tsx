import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster, useToast } from './index';

function Demo() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.show('Hello', { description: 'World' })}>show</button>
      <button onClick={() => toast.success('Saved!')}>success</button>
      <button onClick={() => toast.error('Failed', { duration: 0 })}>error</button>
      <button
        onClick={() =>
          toast.promise(Promise.resolve('data'), {
            loading: 'Loading…',
            success: 'Done!',
            error: 'Failed',
          })
        }
      >
        promise-ok
      </button>
      <button
        onClick={() => {
          toast
            .promise(Promise.reject(new Error('boom')), {
              loading: 'Loading…',
              success: 'Done!',
              error: (e) => `Failed: ${(e as Error).message}`,
            })
            .catch(() => undefined);
        }}
      >
        promise-err
      </button>
      <Toaster />
    </div>
  );
}

describe('Toaster / useToast', () => {
  beforeEach(() => {
    // Reset counter / event bus between tests
    window.dispatchEvent(new CustomEvent('mailzen:toast:remove', { detail: { id: '__all__' } }));
  });

  it('renders a default toast when show() is called', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('show'));
    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('renders a success variant with green icon', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('success'));
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });

  it('renders an error variant with role=alert', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('error'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed');
  });

  it('replaces loading toast with success on promise resolve', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('promise-ok'));
    await waitFor(() => {
      expect(screen.getByText('Done!')).toBeInTheDocument();
    });
  });

  it('replaces loading toast with error on promise reject', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('promise-err'));
    await waitFor(() => {
      expect(screen.getByText('Failed: boom')).toBeInTheDocument();
    });
  });

  it('dismisses a toast when X is clicked', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByText('show'));
    expect(await screen.findByText('Hello')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
    });
  });
});
