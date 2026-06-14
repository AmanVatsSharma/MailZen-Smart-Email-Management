'use client';

import { useState } from 'react';
import { CommandPalette } from '@/components/composites/command-palette';
import type { ComponentManifest } from '../manifest-types';

export const commandPaletteManifest: ComponentManifest = {
  name: 'CommandPalette',
  description: 'Quick-access command bar triggered by Cmd/Ctrl+K. Supports groups, keyboard nav, async search.',
  category: 'composites',
  iconName: 'Terminal',
  Preview: (props) => {
    // The state toggle is rendered via the manifest system — for command-palette
    // we render a button that toggles the open state using React state inside.
    // This component is rendered by PlaygroundShell with no control wiring for
    // the open flag itself; we use local state via a wrapper below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <CommandPaletteWrapper hint={props.hint as string | undefined} />;
  },
  controls: [
    { name: 'hint', type: 'text', default: 'Press Cmd+K to toggle' },
  ],
  code: `<CommandPalette
  open={open}
  onOpenChange={setOpen}
  groups={groups}
  placeholder="\${hint}"
/>`,
};

// Local wrapper with internal open state — 'use client' inherited via module scope
function CommandPaletteWrapper({ hint }: { hint?: string }) {
  const [open, setOpen] = useState(false);
  const groups = [
    {
      id: 'demo',
      label: 'Demo commands',
      items: [
        { id: '1', label: 'Compose email', onSelect: () => {} },
        { id: '2', label: 'Go to Inbox', onSelect: () => {} },
        { id: '3', label: 'Settings', onSelect: () => {} },
      ],
    },
  ];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border-subtle bg-surface-1 px-4 py-2 text-sm hover:bg-surface-2"
      >
        {hint || 'Press Cmd+K to open'}
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} groups={groups} />
    </>
  );
}
