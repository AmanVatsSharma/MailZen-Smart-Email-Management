# MailZen UI Components

This directory contains all the UI components used in the MailZen application. These components are built using ShadCN UI, a collection of re-usable components built with Radix UI and Tailwind CSS.

## Component Organization

- **Basic UI components:** Button, Input, Card, etc.
- **Form components:** Form fields, validation, etc.
- **Layout components:** Grid, Flex, etc.
- **Feedback components:** Alert, Toast, etc.
- **Navigation components:** Tabs, Accordion, etc.

## Design tokens (high level)

- **Colors / radius**: configured via CSS variables in `frontend/app/globals.css` and consumed via Tailwind (`hsl(var(--primary))`, etc.).
- **Typography**:\n  - `frontend/app/layout.tsx` injects the app font via Next.js and sets `--font-sans`.\n  - `frontend/app/globals.css` provides safe fallbacks for `--font-sans`/`--font-mono`.\n
## Input: prefix/suffix contract

`Input` supports visual adornments so pages can render icons without hacking padding wrappers.

- **Props**:\n  - `prefix?: React.ReactNode`\n  - `suffix?: React.ReactNode`\n  - `containerClassName?: string`\n- **Behavior**:\n  - If no `prefix`/`suffix` is provided, `Input` renders as a plain `<input>` (fast path).\n  - If `prefix`/`suffix` is provided, `Input` renders a relative container with absolute adornments.\n  - `prefix` uses `pointer-events-none` by default so it doesn’t block focusing the input.\n
## Form Example with React Hook Form and Zod

We've implemented a form example using React Hook Form with Zod validation. This provides a type-safe and easy-to-use form validation solution.

### Usage Example

```tsx
import { z } from 'zod';
import { useZodForm, validationSchemas } from '@/lib/utils/form-utils';

// Define your form schema
const formSchema = z.object({
  email: validationSchemas.email,
  password: validationSchemas.password,
  // Add more fields as needed
});

type FormValues = z.infer<typeof formSchema>;

function MyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(formSchema);

  const onSubmit = (data: FormValues) => {
    // Handle form submission
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}

      <input type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}

      <button type="submit">Submit</button>
    </form>
  );
}
```

## Apollo GraphQL Integration

We've also set up Apollo Client for GraphQL integration. This allows for efficient data fetching and state management.

### Usage Example

```tsx
import { gql, useQuery } from '@apollo/client';

const GET_EMAILS = gql`
  query GetEmails {
    emails {
      id
      subject
      sender
      timestamp
      read
    }
  }
`;

function EmailList() {
  const { loading, error, data } = useQuery(GET_EMAILS);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      {data.emails.map(email => (
        <div key={email.id}>
          <h3>{email.subject}</h3>
          <p>From: {email.sender}</p>
        </div>
      ))}
    </div>
  );
}
```

## Best Practices

1. **Component Props:** Always define and use proper TypeScript interfaces for component props.
2. **Accessibility:** Ensure all components are accessible with proper ARIA attributes.
3. **Responsive Design:** Make sure components work well on all screen sizes.
4. **Performance:** Be mindful of component re-renders and optimize when necessary.
5. **Testing:** Write tests for all components to ensure they work as expected.
