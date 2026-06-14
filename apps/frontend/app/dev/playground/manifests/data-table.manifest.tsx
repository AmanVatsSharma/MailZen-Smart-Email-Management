'use client';

import { DataTable } from '@/components/composites/data-table';
import type { ComponentManifest } from '../manifest-types';
import type { ColumnDef } from '@tanstack/react-table';

type Email = { id: string; from: string; subject: string; date: string };

const columns: ColumnDef<Email>[] = [
  { accessorKey: 'from', header: 'From' },
  { accessorKey: 'subject', header: 'Subject' },
  { accessorKey: 'date', header: 'Date' },
];

const SAMPLE_DATA: Email[] = [
  { id: '1', from: 'aman@mailzen.dev', subject: 'Welcome to MailZen', date: '2024-01-15' },
  { id: '2', from: 'priya@mailzen.dev', subject: 'Re: Project update', date: '2024-01-14' },
  { id: '3', from: 'ravi@mailzen.dev', subject: 'Weekly standup notes', date: '2024-01-13' },
];

export const dataTableManifest: ComponentManifest = {
  name: 'DataTable',
  description: 'Full-featured table with sorting, selection, pagination, and toolbar. Backed by TanStack Table.',
  category: 'composites',
  iconName: 'Table',
  Preview: (props) => {
    return (
      <DataTable<Email>
        data={SAMPLE_DATA}
        columns={columns}
        state={{ status: 'success', data: SAMPLE_DATA }}
        getRowId={(row) => row.id}
        density={props.density === 'compact' ? 'compact' : 'comfortable'}
        selection={props.selection ? 'multi' : undefined}
      />
    );
  },
  controls: [
    { name: 'density', type: 'select', options: ['comfortable', 'compact'], default: 'comfortable' },
    { name: 'selection', type: 'boolean', default: false },
  ],
  code: `<DataTable
  data={emails}
  columns={columns}
  state={state}
  getRowId={(row) => row.id}
  density="\${density}"
  selection={"\${selection}" === "true" ? 'multi' : undefined}
/>`,
};
