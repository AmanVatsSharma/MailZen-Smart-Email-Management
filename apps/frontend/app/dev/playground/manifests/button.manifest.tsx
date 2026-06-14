import { Button } from '@/components/ui/button';
import type { ComponentManifest } from '../manifest-types';

export const buttonManifest: ComponentManifest = {
  name: 'Button',
  description: 'Primary action button. Variants: default, destructive, outline, ghost, link.',
  category: 'primitives',
  iconName: 'Square',
  Preview: (props) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Button variant={props.variant as any} size={props.size as any} disabled={Boolean(props.disabled)}>
      {props.children as string}
    </Button>;
  },
  controls: [
    { name: 'children', type: 'text', default: 'Send email' },
    { name: 'variant', type: 'select', options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'premium'], default: 'default' },
    { name: 'size', type: 'select', options: ['sm', 'default', 'lg', 'icon'], default: 'default' },
    { name: 'disabled', type: 'boolean', default: false },
  ],
  code: `<Button variant="\${variant}" size="\${size}" disabled={${'${disabled}'}}>
  \${children}
</Button>`,
};
