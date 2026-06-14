'use client';

import { useState } from 'react';
import { Nav, type Manifest } from './nav';
import { PropControls, type ControlValues } from './prop-controls';
import { CodeSnippet } from './code-snippet';
import type { ComponentManifest } from '../manifest-types';

export function PlaygroundShell({ manifests }: { manifests: ComponentManifest[] }) {
  const [activeName, setActiveName] = useState(manifests[0]?.name ?? '');
  const active = manifests.find((m) => m.name === activeName) ?? manifests[0];

  const [values, setValues] = useState<ControlValues>(() => {
    const initial: ControlValues = {};
    manifests.forEach((m) => {
      initial[m.name] = {};
      m.controls.forEach((c) => {
        initial[m.name][c.name] = c.default;
      });
    });
    return initial;
  });

  if (!active) return <div>No manifests registered</div>;

  const currentValues = values[active.name] ?? {};
  const resolvedProps: Record<string, unknown> = {};
  active.controls.forEach((c) => {
    resolvedProps[c.name] = currentValues[c.name];
  });

  // Render the code snippet with ${name} replaced by the value
  const code = active.code.replace(/\$\{(\w+)\}/g, (_, name) => {
    const v = currentValues[name];
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  });

  return (
    <div className="grid grid-cols-[220px_1fr_280px] h-[calc(100vh-64px)] gap-0">
      <Nav
        manifests={manifests as unknown as Manifest[]}
        active={activeName}
        onSelect={setActiveName}
      />
      <div className="flex flex-col border-l border-r border-border-subtle overflow-hidden">
        <div className="flex-1 overflow-auto p-8 bg-surface-2 flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <active.Preview {...resolvedProps} />
          </div>
        </div>
        <div className="border-t border-border-subtle bg-surface-1">
          <CodeSnippet code={code} />
        </div>
      </div>
      <PropControls
        controls={active.controls}
        values={currentValues}
        onChange={(name, value) =>
          setValues((prev) => ({
            ...prev,
            [active.name]: { ...(prev[active.name] ?? {}), [name]: value },
          }))
        }
      />
    </div>
  );
}
