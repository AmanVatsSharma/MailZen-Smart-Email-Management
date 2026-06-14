import type { ReactNode } from 'react';

export type PropControlSpec =
  | { name: string; type: 'text'; default: string }
  | { name: string; type: 'select'; options: readonly string[]; default: string }
  | { name: string; type: 'boolean'; default: boolean }
  | { name: string; type: 'number'; default: number; min?: number; max?: number };

export type ComponentManifest = {
  name: string;
  description?: string;
  /** Live preview component receiving the resolved props */
  Preview: (props: Record<string, unknown>) => ReactNode;
  /** Each prop's spec */
  controls: PropControlSpec[];
  /** Code snippet shown below the preview (string with ${var} placeholders matching control names) */
  code: string;
  /** Lucide icon name (string) — rendered by nav */
  iconName?: string;
  /** Category for grouping in the nav */
  category: 'primitives' | 'patterns' | 'composites';
};
