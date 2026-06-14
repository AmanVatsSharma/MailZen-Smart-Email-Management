'use client';

import * as Icons from 'lucide-react';
import { cn } from '@/lib/tokens/cn';
import type { ComponentManifest } from '../manifest-types';

export type Manifest = ComponentManifest;

const CATEGORY_ORDER: Array<ComponentManifest['category']> = ['primitives', 'patterns', 'composites'];
const CATEGORY_LABELS: Record<ComponentManifest['category'], string> = {
  primitives: 'Primitives',
  patterns: 'Patterns',
  composites: 'Composites',
};

export function Nav({ manifests, active, onSelect }: { manifests: Manifest[]; active: string; onSelect: (name: string) => void }) {
  const grouped: Record<string, Manifest[]> = {};
  manifests.forEach((m) => {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  });

  return (
    <nav className="overflow-y-auto bg-surface-1 p-3">
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={cat} className="mb-4">
            <h3 className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABELS[cat]}
            </h3>
            <ul className="space-y-0.5">
              {items.map((m) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const IconComp = (m.iconName && (Icons as any)[m.iconName]) || Icons.Box;
                return (
                  <li key={m.name}>
                    <button
                      onClick={() => onSelect(m.name)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left',
                        active === m.name
                          ? 'bg-brand-50 text-brand-900 font-medium'
                          : 'hover:bg-surface-2 text-foreground'
                      )}
                    >
                      <IconComp className="h-3.5 w-3.5" />
                      <span>{m.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
