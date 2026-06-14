import { Field } from '@/components/patterns/field';
import { Input } from '@/components/ui/input';
import type { ComponentManifest } from '../manifest-types';

export const fieldManifest: ComponentManifest = {
  name: 'Field',
  description: 'Form field wrapper that pairs a label, optional description, and an input. Injects aria-describedby/aria-invalid into the child input.',
  category: 'patterns',
  iconName: 'FormInput',
  Preview: (props) => {
    return (
      <Field
        label={props.label as string}
        description={props.description as string | undefined}
        error={props.error as string | undefined}
        required={Boolean(props.required)}
        hint={props.hint as string | undefined}
      >
        <Input defaultValue="" placeholder="Type here…" />
      </Field>
    );
  },
  controls: [
    { name: 'label', type: 'text', default: 'Email address' },
    { name: 'description', type: 'text', default: 'We will never share your email.' },
    { name: 'hint', type: 'text', default: 'Optional' },
    { name: 'error', type: 'text', default: '' },
    { name: 'required', type: 'boolean', default: false },
  ],
  code: `<Field
  label="\${label}"
  description="\${description}"
  hint="\${hint}"
  error="\${error}"
  required={${'${required}'}}
>
  <Input placeholder="Type here…" />
</Field>`,
};
