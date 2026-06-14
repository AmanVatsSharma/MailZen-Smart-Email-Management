'use client';

import { StatCard } from '@/components/composites/stat-card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { ComponentManifest } from '../manifest-types';

export const statCardManifest: ComponentManifest = {
  name: 'StatCard',
  description: 'Single-metric summary tile with optional trend delta and helper text.',
  category: 'composites',
  iconName: 'TrendingUp',
  Preview: (props) => {
    const hasDelta = Boolean(props.delta);
    const trend = (props.trend as 'up' | 'down' | 'flat') ?? 'flat';
    const Icon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
    const color = trend === 'up' ? 'text-success-600' : trend === 'down' ? 'text-danger-600' : 'text-muted-foreground';
    return (
      <div className="max-w-xs">
        <StatCard
          label={props.label as string}
          value={props.value as string}
          helper={props.helper as string | undefined}
          delta={
            hasDelta
              ? {
                  value: props.deltaValue as string | number,
                  trend,
                  period: props.period as string | undefined,
                }
              : undefined
          }
        />
      </div>
    );
  },
  controls: [
    { name: 'label', type: 'text', default: 'Inbox Zero Days' },
    { name: 'value', type: 'text', default: '42' },
    { name: 'helper', type: 'text', default: 'vs last week' },
    { name: 'delta', type: 'boolean', default: true },
    { name: 'deltaValue', type: 'text', default: '+8' },
    { name: 'trend', type: 'select', options: ['up', 'down', 'flat'], default: 'up' },
    { name: 'period', type: 'text', default: 'vs last week' },
  ],
  code: `<StatCard
  label="\${label}"
  value="\${value}"
  helper="\${helper}"
  delta={{
    value: "\${deltaValue}",
    trend: "\${trend}",
    period: "\${period}",
  }}
/>`,
};
