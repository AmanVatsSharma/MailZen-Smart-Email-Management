'use client';

import { MetricTile } from '@/components/composites/metric-tile';
import { ProgressRing } from '@/components/composites/progress-ring';
import { Mail } from 'lucide-react';
import type { ComponentManifest } from '../manifest-types';

export const metricTileManifest: ComponentManifest = {
  name: 'MetricTile',
  description: 'Denser resource-tracking tile. When `progress` is supplied a ProgressRing is shown inline.',
  category: 'composites',
  iconName: 'HardDrive',
  Preview: (props) => {
    return (
      <div className="max-w-xs">
        <MetricTile
          label={props.label as string}
          value={props.value as string}
          total={props.total as string | undefined}
          progress={props.showProgress ? Number(props.progress ?? 0.42) : undefined}
          trend={(props.trend as 'up' | 'down' | 'flat') ?? 'flat'}
          period={props.period as string | undefined}
          icon={<Mail className="h-3 w-3" />}
        />
      </div>
    );
  },
  controls: [
    { name: 'label', type: 'text', default: 'Storage' },
    { name: 'value', type: 'text', default: '4.2 GB' },
    { name: 'total', type: 'text', default: '15 GB' },
    { name: 'period', type: 'text', default: 'this month' },
    { name: 'trend', type: 'select', options: ['up', 'down', 'flat'], default: 'up' },
    { name: 'showProgress', type: 'boolean', default: true },
    { name: 'progress', type: 'number', default: 42, min: 0, max: 100 },
  ],
  code: `<MetricTile
  label="\${label}"
  value="\${value}"
  total="\${total}"
  progress={${'${showProgress}'} ? \${progress} / 100 : undefined}
  trend="\${trend}"
  period="\${period}"
/>`,
};
