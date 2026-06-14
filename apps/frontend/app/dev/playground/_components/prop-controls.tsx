'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/tokens/cn';
import type { PropControlSpec } from '../manifest-types';

export type ControlValues = Record<string, Record<string, unknown>>;

export function PropControls({
  controls,
  values,
  onChange,
}: {
  controls: PropControlSpec[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}) {
  return (
    <aside className="overflow-y-auto bg-surface-1 p-4 border-l border-border-subtle">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Props
      </h3>
      <div className="space-y-4">
        {controls.map((c) => (
          <div key={c.name} className="space-y-1.5">
            <Label htmlFor={c.name} className="text-xs font-medium">
              {c.name}
              <span className="ml-1 text-muted-foreground font-normal">({c.type})</span>
            </Label>
            {c.type === 'text' && (
              <Input
                id={c.name}
                value={String(values[c.name] ?? '')}
                onChange={(e) => onChange(c.name, e.target.value)}
              />
            )}
            {c.type === 'number' && (
              <Input
                id={c.name}
                type="number"
                value={Number(values[c.name] ?? 0)}
                min={c.min}
                max={c.max}
                onChange={(e) => onChange(c.name, Number(e.target.value))}
              />
            )}
            {c.type === 'boolean' && (
              <div className="flex items-center gap-2">
                <Switch
                  id={c.name}
                  checked={Boolean(values[c.name])}
                  onCheckedChange={(v) => onChange(c.name, v)}
                />
                <span className="text-xs text-muted-foreground">
                  {values[c.name] ? 'true' : 'false'}
                </span>
              </div>
            )}
            {c.type === 'select' && (
              <select
                id={c.name}
                value={String(values[c.name] ?? '')}
                onChange={(e) => onChange(c.name, e.target.value)}
                className={cn(
                  'w-full h-9 rounded-md border border-border-default bg-surface-1 px-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-brand-500'
                )}
              >
                {c.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
