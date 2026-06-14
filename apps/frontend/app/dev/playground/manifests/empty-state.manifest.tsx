'use client';

import { EmptyState } from '@/components/patterns/empty-state';
import type { ComponentManifest } from '../manifest-types';

export const emptyStateManifest: ComponentManifest = {
  name: 'EmptyState',
  description: 'Friendly empty/no-data state with optional action and secondary action.',
  category: 'patterns',
  iconName: 'Inbox',
  Preview: (props) => {
    return (
      <EmptyState
        variant={props.variant as 'no-data' | 'no-results' | 'no-access' | 'error' | 'coming-soon'}
        title={props.title as string | undefined}
        description={props.description as string | undefined}
        size={props.size as 'sm' | 'md' | 'lg'}
      />
    );
  },
  controls: [
    { name: 'variant', type: 'select', options: ['no-data', 'no-results', 'no-access', 'error', 'coming-soon'], default: 'no-data' },
    { name: 'title', type: 'text', default: 'No data yet' },
    { name: 'description', type: 'text', default: 'Get started by creating your first item.' },
    { name: 'size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
  ],
  code: `<EmptyState
  variant="\${variant}"
  title="\${title}"
  description="\${description}"
  size="\${size}"
/>`,
};
