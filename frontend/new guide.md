# MailZen Frontend Development Guide

## Overview

This guide provides comprehensive instructions for frontend developers to create the MailZen user interface and connect it to the existing backend. MailZen is an advanced email management platform that integrates with Gmail, Outlook, and custom SMTP providers, offering features like unified inbox, AI-powered smart replies, email warmup, and more.

## Table of Contents

- Project Overview
- Tech Stack
- Frontend Architecture
- UI Design Guidelines
- Key Screens & Components
- Backend Integration
- Authentication Flow
- Feature Implementation Guide
- Testing
- Performance Considerations
- Deployment
- Premium UI Design System

## Project Overview

MailZen is a comprehensive email management SaaS with the following core features:

- Unified Inbox: Connect multiple email providers (Gmail, Outlook, Custom SMTP)
- Email Management: Send/receive emails across multiple providers
- Organization: Categorize emails using labels, folders, and smart filters
- Smart Replies: AI-generated response suggestions
- Email Filtering: Advanced filtering rules for email organization
- Email Warmup: Deliverability enhancement through automated warmup routines
- Contacts Management: Store and organize contacts

## Tech Stack

**Recommended Frontend Tech Stack:**

- Framework: Next.js 14+ (App Router)
- Language: TypeScript
- Styling: TailwindCSS with ShadCN UI
- State Management: React Context API and/or Zustand
- API Integration: Apollo Client (for GraphQL)
- Form Handling: React Hook Form with Zod validation
- Authentication: NextAuth.js integrated with JWT from backend

## Frontend Architecture

**Project Structure**

```plaintext
src/
├── app/                     # Next.js App Router
│   ├── (auth)/              # Authentication routes (login, signup)
│   ├── (dashboard)/         # Protected dashboard routes
│   │   ├── inbox/           # Unified inbox page
│   │   ├── sent/            # Sent emails page
│   │   ├── contacts/        # Contacts management
│   │   ├── settings/        # User settings
│   │   └── filters/         # Email filters configuration
│   └── layout.tsx           # Root layout
├── components/              # Reusable UI components
│   ├── ui/                  # Base UI components from ShadCN
│   ├── email/               # Email-related components
│   ├── contacts/            # Contact-related components
│   ├── filters/             # Filter-related components
│   └── warmup/              # Email warmup components
├── lib/                     # Utility functions and shared code
│   ├── apollo/              # Apollo client setup
│   ├── auth/                # Authentication utilities
│   └── utils/               # Helper functions
├── graphql/                 # GraphQL queries and mutations
│   ├── email/               # Email-related queries/mutations
│   ├── contacts/            # Contact-related queries/mutations
│   ├── filters/             # Filter-related queries/mutations
│   └── warmup/              # Warmup-related queries/mutations
└── types/                   # TypeScript type definitions
```

## UI Design Guidelines

**Design System**  
MailZen should follow a clean, professional design with a focus on readability and usability:

**Color Palette:**

- Primary: #3B82F6 (blue-500)
- Secondary: #10B981 (emerald-500)
- Accent: #8B5CF6 (violet-500)
- Background: #F9FAFB (gray-50)
- Text: #1F2937 (gray-800)

**Typography:**

- Font Family: Inter
- Headings: Semi-bold, sizes h1: 2rem, h2: 1.5rem, h3: 1.25rem
- Body: Regular, size 1rem
- Small text: 0.875rem

**Spacing:**

- Base unit: 0.25rem
- Common spacings: 1rem, 1.5rem, 2rem, 3rem

**Shadows:**

- Subtle: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
- Medium: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
- Strong: 0 10px 15px -3px rgba(0, 0, 0, 0.1)

**Responsive Design**

- Mobile-first approach
- Breakpoints:
  - sm: 640px
  - md: 768px
  - lg: 1024px
  - xl: 1280px
  - 2xl: 1536px

## Key Screens & Components

1. **Authentication Screens**

   - Login: Email/password login with OAuth options (Google, Outlook)
   - Signup: New account creation
   - Forgot Password: Password recovery flow

2. **Dashboard & Email Management**

   - Unified Inbox: Display emails from all connected accounts
   - Email list component with threading support
   - Quick actions (read, archive, delete)
   - Email preview panel
   - Email Detail View: Full email content with reply/forward options
   - Compose Email: Rich text editor with template support

3. **Email Provider Management**

   - Connect Provider: UI for adding email providers
   - OAuth flow for Gmail/Outlook
   - Custom SMTP configuration form
   - Provider Settings: UI for managing provider configurations

4. **Smart Replies**

   - Suggestions Panel: Display AI-generated reply suggestions
   - Generate Reply Button: Trigger for generating smart replies

5. **Contact Management**

   - Contact List: Display all contacts with search and filter
   - Contact Detail: View and edit contact information
   - Add Contact Form: Create new contacts

6. **Email Filters**

   - Filter List: Display all configured filters
   - Filter Creation: Intuitive UI for creating complex filter rules
   - Filter Actions: Configure actions for matching emails

7. **Email Warmup**
   - Warmup Dashboard: Display warmup status and metrics
   - Warmup Configuration: UI for setting up warmup parameters
   - Pause/Resume Controls: Manage warmup process

## Backend Integration

**GraphQL Setup**  
Install required packages:

```bash
npm install @apollo/client graphql
```

Configure Apollo Client:

```typescript
// lib/apollo/client.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql',
});

const authLink = setContext((_, { headers }) => {
  // Get the authentication token from localStorage
  const token = localStorage.getItem('token');

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

Add Apollo Provider to your app:

```typescript
// app/layout.tsx
'use client';

import { ApolloProvider } from '@apollo/client';
import { client } from '@/lib/apollo/client';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ApolloProvider client={client}>
          {children}
        </ApolloProvider>
      </body>
    </html>
  );
}
```

## Example GraphQL Queries and Mutations

**Contact Management**

```typescript
// graphql/contacts/queries.ts
import { gql } from '@apollo/client';

export const GET_ALL_CONTACTS = gql`
  query GetAllContacts {
    getAllContacts {
      id
      name
      email
      phone
      createdAt
      updatedAt
    }
  }
`;

export const GET_CONTACT = gql`
  query GetContact($id: String!) {
    getContact(id: $id) {
      id
      name
      email
      phone
      createdAt
      updatedAt
    }
  }
`;

// graphql/contacts/mutations.ts
import { gql } from '@apollo/client';

export const CREATE_CONTACT = gql`
  mutation CreateContact($createContactInput: CreateContactInput!) {
    createContact(createContactInput: $createContactInput) {
      id
      name
      email
      phone
    }
  }
`;

export const UPDATE_CONTACT = gql`
  mutation UpdateContact($updateContactInput: UpdateContactInput!) {
    updateContact(updateContactInput: $updateContactInput) {
      id
      name
      email
      phone
    }
  }
`;

export const DELETE_CONTACT = gql`
  mutation DeleteContact($id: String!) {
    deleteContact(id: $id) {
      id
      name
      email
    }
  }
`;
```

**Email Filters**

```typescript
// graphql/filters/queries.ts
import { gql } from '@apollo/client';

export const GET_EMAIL_FILTERS = gql`
  query GetEmailFilters {
    getEmailFilters {
      id
      name
      conditions {
        fromEmail
        subject
        bodyContains
      }
      actions {
        moveTo
        markAs
        forward
      }
      active
      createdAt
      updatedAt
    }
  }
`;

// graphql/filters/mutations.ts
import { gql } from '@apollo/client';

export const CREATE_EMAIL_FILTER = gql`
  mutation CreateEmailFilter($createEmailFilterInput: CreateEmailFilterInput!) {
    createEmailFilter(createEmailFilterInput: $createEmailFilterInput) {
      id
      name
      conditions {
        fromEmail
        subject
        bodyContains
      }
      actions {
        moveTo
        markAs
        forward
      }
      active
    }
  }
`;

export const DELETE_EMAIL_FILTER = gql`
  mutation DeleteEmailFilter($id: String!) {
    deleteEmailFilter(id: $id) {
      id
      name
    }
  }
`;
```

**Email Warmup**

```typescript
// graphql/warmup/queries.ts
import { gql } from '@apollo/client';

export const GET_EMAIL_WARMUP_STATUS = gql`
  query GetEmailWarmupStatus($providerId: String!) {
    getEmailWarmupStatus(providerId: $providerId) {
      config {
        id
        providerId
        status
        dailyIncrement
        startVolume
        maxVolume
        currentVolume
        createdAt
        updatedAt
      }
      stats {
        id
        sentCount
        deliveredCount
        openedCount
        repliedCount
        bounceCount
        spamCount
        date
      }
    }
  }
`;

// graphql/warmup/mutations.ts
import { gql } from '@apollo/client';

export const START_EMAIL_WARMUP = gql`
  mutation StartEmailWarmup($startWarmupInput: StartWarmupInput!) {
    startEmailWarmup(startWarmupInput: $startWarmupInput) {
      id
      providerId
      status
      dailyIncrement
      startVolume
      maxVolume
      currentVolume
    }
  }
`;

export const PAUSE_EMAIL_WARMUP = gql`
  mutation PauseEmailWarmup($pauseWarmupInput: PauseWarmupInput!) {
    pauseEmailWarmup(pauseWarmupInput: $pauseWarmupInput) {
      id
      providerId
      status
    }
  }
`;
```

**Smart Replies**

```typescript
// graphql/smartReplies/queries.ts
import { gql } from '@apollo/client';

export const GENERATE_SMART_REPLY = gql`
  query GenerateSmartReply($input: SmartReplyInput!) {
    generateSmartReply(input: $input)
  }
`;

export const GET_SUGGESTED_REPLIES = gql`
  query GetSuggestedReplies($emailBody: String!, $count: Int) {
    getSuggestedReplies(emailBody: $emailBody, count: $count)
  }
`;
```

## Authentication Flow

**Login Flow**

1. User enters credentials on login page
2. Frontend sends login request to backend GraphQL API
3. On successful login, backend returns JWT token
4. Frontend stores token in localStorage and redirects to dashboard

**Example login component**

```typescript
import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        name
      }
    }
  }
`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const [login, { loading, error }] = useMutation(LOGIN_MUTATION, {
    onCompleted: (data) => {
      localStorage.setItem('token', data.login.token);
      localStorage.setItem('user', JSON.stringify(data.login.user));
      router.push('/dashboard');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    login({ variables: { email, password } });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p className="text-red-500">Error: {error.message}</p>}
    </form>
  );
}
```

**OAuth Integration**  
For Google/Outlook login:

- Create OAuth buttons that redirect to backend OAuth endpoints
- Backend handles OAuth flow and returns JWT on successful authentication
- Redirect back to frontend with token in URL params
- Frontend extracts and stores the token

## Feature Implementation Guide

### 1. Contacts Management Implementation

```typescript
// components/contacts/ContactList.tsx
'use client';

import { useQuery } from '@apollo/client';
import { GET_ALL_CONTACTS } from '@/graphql/contacts/queries';
import { Contact } from '@/types';

export default function ContactList() {
  const { loading, error, data } = useQuery(GET_ALL_CONTACTS);

  if (loading) return <p>Loading contacts...</p>;
  if (error) return <p>Error loading contacts: {error.message}</p>;

  const contacts = data?.getAllContacts || [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">My Contacts</h2>
      {contacts.length === 0 ? (
        <p>No contacts found. Add your first contact!</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {contacts.map((contact: Contact) => (
            <li key={contact.id} className="py-3">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-medium">{contact.name}</h3>
                  <p className="text-sm text-gray-500">{contact.email}</p>
                  {contact.phone && (
                    <p className="text-xs text-gray-400">{contact.phone}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button className="text-blue-500 hover:text-blue-700">Edit</button>
                  <button className="text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 2. Email Filters Implementation

```typescript
// components/filters/CreateFilterForm.tsx
'use client';

import { useMutation } from '@apollo/client';
import { useForm } from 'react-hook-form';
import { CREATE_EMAIL_FILTER } from '@/graphql/filters/mutations';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const filterSchema = z.object({
  name: z.string().min(1, "Filter name is required"),
  conditions: z.object({
    fromEmail: z.string().optional(),
    subject: z.string().optional(),
    bodyContains: z.array(z.string()).optional(),
  }),
  actions: z.object({
    moveTo: z.string().optional(),
    markAs: z.string().optional(),
    forward: z.boolean().optional(),
  }),
  active: z.boolean().default(true),
});

type FilterFormValues = z.infer<typeof filterSchema>;

export default function CreateFilterForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      conditions: { bodyContains: [] },
      actions: { forward: false },
      active: true,
    }
  });

  const [createFilter, { loading }] = useMutation(CREATE_EMAIL_FILTER, {
    onCompleted: () => {
      // Show success message or redirect
    },
    refetchQueries: ['GetEmailFilters'] // Refresh the filters list
  });

  const onSubmit = (data: FilterFormValues) => {
    createFilter({
      variables: {
        createEmailFilterInput: data
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium">Filter Name</label>
        <input
          type="text"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
      </div>

      <div className="border p-4 rounded-md">
        <h3 className="font-medium mb-3">Conditions</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">From Email</label>
            <input
              type="text"
              {...register('conditions.fromEmail')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="sender@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Subject Contains</label>
            <input
              type="text"
              {...register('conditions.subject')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Important, Urgent, etc."
            />
          </div>

          {/* Additional condition fields */}
        </div>
      </div>

      <div className="border p-4 rounded-md">
        <h3 className="font-medium mb-3">Actions</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Move To</label>
            <select
              {...register('actions.moveTo')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="">Select Folder</option>
              <option value="INBOX">Inbox</option>
              <option value="SPAM">Spam</option>
              <option value="TRASH">Trash</option>
              <option value="ARCHIVE">Archive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">Mark As</label>
            <select
              {...register('actions.markAs')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="">Select Status</option>
              <option value="READ">Read</option>
              <option value="UNREAD">Unread</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="forward"
              {...register('actions.forward')}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="forward" className="ml-2 block text-sm">
              Forward Email
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="active"
          {...register('active')}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
        />
        <label htmlFor="active" className="ml-2 block text-sm">
          Filter Active
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Filter'}
      </button>
    </form>
  );
}
```

### 3. Email Warmup Implementation

```typescript
// components/warmup/WarmupDashboard.tsx
'use client';

import { useQuery } from '@apollo/client';
import { GET_EMAIL_WARMUP_STATUS } from '@/graphql/warmup/queries';
import WarmupControls from './WarmupControls';
import WarmupStats from './WarmupStats';

type WarmupDashboardProps = {
  providerId: string;
};

export default function WarmupDashboard({ providerId }: WarmupDashboardProps) {
  const { loading, error, data, refetch } = useQuery(GET_EMAIL_WARMUP_STATUS, {
    variables: { providerId },
    pollInterval: 300000, // Refresh every 5 minutes
  });

  if (loading) return <p>Loading warmup status...</p>;
  if (error) return <p>Error loading warmup status: {error.message}</p>;

  const { config, stats } = data?.getEmailWarmupStatus || { config: null, stats: [] };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Email Warmup Dashboard</h2>

      {!config ? (
        <div className="bg-yellow-50 p-4 rounded-md">
          <p className="text-yellow-800">
            No warmup configuration found for this provider. Set up a warmup plan to improve email deliverability.
          </p>
          <WarmupControls
            providerId={providerId}
            warmupConfig={null}
            onSuccess={refetch}
          />
        </div>
      ) : (
        <>
          <div className="bg-white p-4 rounded-md shadow-sm">
            <h3 className="font-medium text-lg mb-3">Warmup Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className={`font-medium ${config.status === 'ACTIVE' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {config.status}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Daily Increment</p>
                <p className="font-medium">{config.dailyIncrement} emails/day</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Volume</p>
                <p className="font-medium">{config.currentVolume} emails/day</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Max Volume</p>
                <p className="font-medium">{config.maxVolume} emails/day</p>
              </div>
            </div>

            <WarmupControls
              providerId={providerId}
              warmupConfig={config}
              onSuccess={refetch}
            />
          </div>

          {stats.length > 0 && (
            <WarmupStats stats={stats} />
          )}
        </>
      )}
    </div>
  );
}
```

### 4. Smart Replies Implementation

```typescript
// components/email/SmartReplySuggestions.tsx
'use client';

import { useLazyQuery } from '@apollo/client';
import { useState } from 'react';
import { GET_SUGGESTED_REPLIES } from '@/graphql/smartReplies/queries';

type SmartReplySuggestionsProps = {
  emailBody: string;
  onSelectReply: (reply: string) => void;
};

export default function SmartReplySuggestions({
  emailBody,
  onSelectReply
}: SmartReplySuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const [getSuggestions, { loading, error, data }] = useLazyQuery(GET_SUGGESTED_REPLIES, {
    variables: { emailBody, count: 3 },
  });

  const handleGetSuggestions = () => {
    getSuggestions();
    setIsExpanded(true);
  };

  const handleSelectReply = (reply: string) => {
    onSelectReply(reply);
    setIsExpanded(false);
  };

  const suggestedReplies = data?.getSuggestedReplies || [];

  return (
    <div className="mt-4">
      {!isExpanded ? (
        <button
          onClick={handleGetSuggestions}
          className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md text-sm hover:bg-blue-100"
        >
          Generate Smart Replies
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium">Suggested Replies</h4>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Hide
            </button>
          </div>

          {loading && <p className="text-sm text-gray-500">Generating suggestions...</p>}
          {error && <p className="text-sm text-red-500">Error: {error.message}</p>}

          {!loading && !error && suggestedReplies.length > 0 && (
            <div className="space-y-2">
              {suggestedReplies.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectReply(reply)}
                  className="block w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Testing

**Testing Strategy**  
**Unit Tests:**

- Test individual components with Jest and React Testing Library
- Test hooks and utility functions

**Integration Tests:**

- Test component interactions
- Test form submissions
- Mock API responses

**E2E Tests:**

- Use Cypress or Playwright to test complete user flows
- Test authentication
- Test key features like email composition and filter creation

**Example Component Test**

```typescript
// components/contacts/ContactList.test.tsx
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import ContactList from './ContactList';
import { GET_ALL_CONTACTS } from '@/graphql/contacts/queries';

const mocks = [
  {
    request: {
      query: GET_ALL_CONTACTS,
    },
    result: {
      data: {
        getAllContacts: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  },
];

describe('ContactList', () => {
  it('renders loading state initially', () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <ContactList />
      </MockedProvider>
    );

    expect(screen.getByText('Loading contacts...')).toBeInTheDocument();
  });

  it('renders contacts when data is loaded', async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <ContactList />
      </MockedProvider>
    );

    // Wait for the query to complete
    const contactName = await screen.findByText('John Doe');

    expect(contactName).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
  });
});
```

## Performance Considerations

**Code Splitting:**

- Use dynamic imports for route-based code splitting
- Lazy load heavy components

**Optimistic UI Updates:**

- Implement optimistic updates for mutations to improve perceived performance

**Caching Strategy:**

- Configure Apollo Client cache policies
- Use ISR (Incremental Static Regeneration) for semi-static content

**Image Optimization:**

- Use Next.js Image component for optimized image loading
- Implement lazy loading for images

**Minimize Bundle Size:**

- Use lightweight alternatives to heavy libraries
- Implement tree-shaking

## Deployment

**Vercel Deployment**

- Connect your GitHub repository to Vercel
- Configure environment variables:
  - NEXT_PUBLIC_GRAPHQL_ENDPOINT: URL to the GraphQL API endpoint
  - Other environment-specific variables

**Docker Deployment**

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

## Next Steps

1. Start by implementing the authentication flows
2. Build the core layout and navigation components
3. Create the inbox and email detail views
4. Implement the provider configuration UI
5. Add smart replies functionality
6. Build the contact management features
7. Implement email filters and warmup features
8. Add comprehensive testing
9. Deploy and continue iterative development

By following this guide, frontend developers can systematically build the MailZen UI and integrate it with the existing backend services. This approach ensures a clean, maintainable, and feature-rich application that meets the project requirements.

# Premium UI Design System

MailZen uses a carefully crafted premium UI design system to elevate the user experience. This guide outlines the key components, styles, and principles to maintain consistency throughout the application.

## Design Principles

- **Professional & Minimal**: Clean interfaces with focused content and clear hierarchy
- **Depth & Dimension**: Subtle shadows, gradients, and hover effects to create a sense of depth
- **Motion & Feedback**: Smooth animations that provide visual feedback and guide attention
- **Premium Feel**: High-quality visuals with attention to detail in every interaction

## Color System

We've updated our color system to create a more premium feel:

- **Primary Color**: Vibrant purple (HSL 265 89% 60%) for important elements and actions
- **Secondary Color**: Emerald (HSL 160 84% 39%) for success states and complementary actions
- **Accent Color**: Violet (HSL 265 89% 65%) for highlighting and visual interest
- **Neutral Palette**: Clean whites and subtle grays for backgrounds and text
- **Semantic Colors**: Red for destructive actions, amber for warnings, etc.

### Dark Mode Support

All colors have dark mode variants that maintain readability and aesthetic appeal in low-light environments.

## Premium Components

### Card Components

Our enhanced card system uses several techniques to create a premium feel:

```jsx
<div className="premium-card p-6">
  <h3 className="premium-text text-xl font-bold">Feature Title</h3>
  <p className="mt-2">Description text goes here...</p>
  <button className="premium-button mt-4">Call to Action</button>
</div>
```

Key features:
- Subtle gradient overlays
- Hover animations with shadow depth changes
- Rounded corners with subtle borders
- 3D transform effects on interaction

### Button Variants

```jsx
// Primary action button with gradient
<Button variant="premium">Upgrade Plan</Button>

// Default button with enhanced styling
<Button>Continue</Button>

// Ghost button for secondary actions
<Button variant="ghost">Cancel</Button>
```

### Text Effects

```jsx
// Gradient text for headings
<h2 className="premium-text text-2xl font-bold">Dashboard</h2>

// Animated text for important metrics
<div className="animate-pulse-subtle text-3xl font-bold">97%</div>
```

## Animation System

Our animation system uses Framer Motion for consistent, high-quality animations:

### Predefined Animations

- `animate-float`: Subtle floating effect for cards and promotional elements
- `animate-pulse-subtle`: Gentle pulsing for drawing attention without distraction
- `animate-gradient-shift`: Dynamic gradient movement for backgrounds
- `animate-fade-in`: Smooth fade in effect for new elements
- `animate-slide-up`: Upward transition for progressive disclosure

### Implementation

```jsx
// Simple animation with preset class
<div className="premium-card animate-float">Content</div>

// Custom Framer Motion animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ 
    duration: 0.5,
    type: "spring",
    stiffness: 100,
    damping: 15
  }}
>
  Content
</motion.div>
```

## Glass Effect

For a modern, depth-creating effect, use the glass effect on floating elements:

```jsx
<div className="glass-effect p-6 rounded-xl">
  <h3>Floating Panel</h3>
  <p>Content with a frosted glass appearance</p>
</div>
```

## Component Examples

### Stats Cards

```jsx
<div className="premium-card p-6">
  <div className="text-3xl font-bold">2,853</div>
  <div className="text-xs text-muted-foreground">
    <span className="text-emerald-500 font-medium">+12%</span> from last month
  </div>
  <div className="mt-4 h-1">
    <Progress value={75} className="h-2" />
  </div>
</div>
```

### Activity Items

```jsx
<motion.div 
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
>
  <div className="flex-shrink-0">
    <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
      <Mail className="h-5 w-5 text-primary" />
    </div>
  </div>
  <div className="flex-1 space-y-1">
    <div className="font-medium">New message from client</div>
    <div className="text-sm text-muted-foreground">
      John Smith sent you an email about the project
    </div>
  </div>
  <Badge variant="outline">New</Badge>
</motion.div>
```

## Best Practices

1. **Consistency**: Use the premium components consistently throughout the application
2. **Accessibility**: Ensure all animations can be disabled for users with vestibular disorders
3. **Performance**: Use animation sparingly on mobile devices to preserve battery life
4. **Subtlety**: Keep animations subtle and purposeful rather than flashy and distracting
5. **Meaningful Motion**: Use motion to guide users and provide feedback, not just for decoration

## Implementation Notes

All premium UI components are built on top of ShadCN UI and TailwindCSS. Custom utility classes are defined in `globals.css` and the Tailwind configuration has been extended with custom animations, shadows, and color utilities.
