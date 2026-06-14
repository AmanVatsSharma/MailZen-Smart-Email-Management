import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from './index';

type Row = { id: string; name: string; email: string };

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
];

const sampleData: Row[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
  { id: '3', name: 'Carol', email: 'carol@example.com' },
];

describe('DataTable', () => {
  it('renders rows from data', () => {
    render(
      <DataTable<Row>
        data={sampleData}
        columns={columns}
        state={{ status: 'success', data: sampleData }}
        getRowId={(row) => row.id}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('renders empty state when status is empty', () => {
    render(
      <DataTable<Row>
        data={[]}
        columns={columns}
        state={{ status: 'empty' }}
        getRowId={(row) => row.id}
        emptyState={{ title: 'No data', description: 'Try again later' }}
      />
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders loading state via DataView', async () => {
    const { container } = render(
      <DataTable<Row>
        data={[]}
        columns={columns}
        state={{ status: 'loading' }}
        getRowId={(row) => row.id}
      />
    );
    // DataView renders skeletons during loading (after flash threshold)
    await waitFor(() => {
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
  });

  it('renders pagination when pagination prop is provided', async () => {
    const onPageChange = jest.fn();
    const user = userEvent.setup();
    render(
      <DataTable<Row>
        data={sampleData}
        columns={columns}
        state={{ status: 'success', data: sampleData }}
        getRowId={(row) => row.id}
        pagination={{ page: 1, pageSize: 2, onPageChange }}
      />
    );
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders toolbar with search input', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    render(
      <DataTable<Row>
        data={sampleData}
        columns={columns}
        state={{ status: 'success', data: sampleData }}
        getRowId={(row) => row.id}
        toolbar={{ search: { value: '', onChange, placeholder: 'Find user' } }}
      />
    );
    const input = screen.getByPlaceholderText('Find user');
    await user.type(input, 'Al');
    // onChange should fire for each character typed. The exact final string is
    // not asserted because the controlled input's value is not lifted into state
    // in this test (the parent test ignores the update), so userEvent resets the
    // value between keystrokes.
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.flat().join('')).toBe('Al');
  });
});
