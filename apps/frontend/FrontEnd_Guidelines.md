# Frontend Development Guidelines for MailZen

## Tech Stack Recommendations:

- React/Next.js for the frontend framework
- Apollo Client for GraphQL integration
- TailwindCSS for styling
- React Query for server state management
- React Hook Form for form handling
- Framer Motion for animations

## Core Features to Implement:

### Authentication:

- Login/Register pages
- JWT token management
- Protected route handling

### Email Dashboard:

- Inbox view with sorting/filtering
- Email composition with rich text editor
- Email scheduling interface
- Email analytics visualization

### Email Organization:

- Folder management (Create, Edit, Delete)
- Label management with color picker
- Drag-and-drop email organization
- Search functionality

### Email Filters:

- Filter creation interface with rule builder
- Filter management (CRUD operations)
- Visual feedback for filter actions

### Email Provider Integration:

- Provider setup wizards (Gmail, Outlook, SMTP)
- OAuth flow handling
- Provider status indicators

## Component Structure:

```plaintext
src/
  ├── components/
  │   ├── layout/
  │   │   ├── Sidebar.tsx
  │   │   ├── Header.tsx
  │   │   └── EmailLayout.tsx
  │   ├── email/
  │   │   ├── EmailList.tsx
  │   │   ├── EmailComposer.tsx
  │   │   ├── EmailViewer.tsx
  │   │   └── EmailActions.tsx
  │   ├── filters/
  │   │   ├── FilterBuilder.tsx
  │   │   ├── FilterList.tsx
  │   │   └── FilterActions.tsx
  │   └── shared/
  │       ├── Button.tsx
  │       ├── Input.tsx
  │       └── Modal.tsx
```

## API Integration:

- GraphQL queries/mutations for all email operations
- Real-time updates using subscriptions
- Error handling and loading states
- Optimistic updates for better UX

## State Management:

- User authentication state
- Email list and current email state
- Filter and label states
- UI state (modals, sidebars, etc.)

## UI/UX Guidelines:

- Clean, modern interface
- Responsive design for all screen sizes
- Keyboard shortcuts for power users
- Loading states and skeleton screens
- Toast notifications for actions
- Drag-and-drop interactions

## Premium UI Components:

We've implemented a suite of premium UI components and styles that should be used across the application:

### Colors:
- Primary color: Vibrant purple (265 89% 60%)
- Secondary & accent colors that complement the primary
- Consistent color application for borders, shadows, and gradients

### Custom Component Classes:

- `.premium-card`: Enhanced card with 3D hover effects, gradient overlays, and shadow depth
- `.premium-text`: Gradient text effect for headings and important labels
- `.premium-button`: Gradient background with hover effects for call-to-action buttons
- `.glass-effect`: Modern frosted glass effect for UI elements

### Animations:

- `.animate-float`: Subtle floating animation for highlighting elements
- `.animate-pulse-subtle`: Gentle pulsing effect for drawing attention
- `.animate-gradient-shift`: Shifting gradient background for dynamic elements

### Component Examples:

```jsx
// Premium Card Example
<div className="premium-card p-6">
  <h3 className="premium-text text-xl font-bold">Feature Title</h3>
  <p className="mt-2">Feature description and details.</p>
  <button className="premium-button px-4 py-2 mt-4 rounded-lg">
    Call to Action
  </button>
</div>

// Stats Card with Animation
<div className="premium-card animate-float p-6">
  <h3 className="text-xl font-bold">456</h3>
  <p className="text-sm text-muted-foreground">Total Emails</p>
  <div className="mt-4">
    <Progress value={65} className="h-2" />
  </div>
</div>
```

## Performance Considerations:

- Implement virtual scrolling for email lists
- Lazy loading for email content
- Image optimization
- Caching strategies
- Bundle size optimization

## Security Best Practices:

- Secure token storage
- XSS prevention
- CSRF protection
- Input validation
- Secure communication with backend

## Accessibility:

- Proper ARIA attributes
- Keyboard navigation support
- Color contrast compliance
- Screen reader compatibility
- Focus states for interactive elements
