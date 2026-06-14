'use client';

import { ProgressRing } from '@/components/composites/progress-ring';
import type { ComponentManifest } from '../manifest-types';

export const progressRingManifest: ComponentManifest = {
  name: 'ProgressRing',
  description: 'Circular progress indicator showing percentage via stroke-dasharray arc.',
  category: 'composites',
  iconName: 'LoaderCircle',
  Preview: (props) => {
    return (
      <ProgressRing
        value={Number(props.value ?? 0.75)}
        size={Number(props.size ?? 64)}
        strokeWidth={Number(props.strokeWidth ?? 6)}
        color={props.color as string | undefined}
        trackColor={props.trackColor as string | undefined}
        label={props.label as string | undefined}
      />
    );
  },
  controls: [
    { name: 'value', type: 'number', default: 75, min: 0, max: 100 },
    { name: 'size', type: 'number', default: 64, min: 32, max: 200 },
    { name: 'strokeWidth', type: 'number', default: 6, min: 2, max: 20 },
    { name: 'color', type: 'text', default: 'var(--color-brand-500)' },
    { name: 'trackColor', type: 'text', default: 'var(--color-border-subtle)' },
    { name: 'label', type: 'text', default: '75%' },
  ],
  code: `<ProgressRing
  value={${'${value}'} / 100}
  size={${'${size}'}}
  strokeWidth={${'${strokeWidth}'}}
  color="\${color}"
  trackColor="\${trackColor}"
  label="\${label}"
/>`,
};
