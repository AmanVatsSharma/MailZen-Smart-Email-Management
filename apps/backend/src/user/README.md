# User Module (Backend)

## Goal

Manage user identity records, profile updates, admin CRUD operations, and
compliance-friendly account data exports.

## Responsibilities

- Create users with hashed passwords
- Validate login credentials with lockout tracking
- Update user profile data with email uniqueness checks
- Provide admin-only user listing and lookup
- Export authenticated user account data snapshot for legal/compliance requests

## GraphQL API

- `users` (admin): list users
- `user(id)` (admin): get single user
- `createUser(createUserInput)` (admin): create user
- `updateUser(updateUserInput)` (admin): update user
- `myAccountDataExport`: export current user account data JSON snapshot

## Flow

```mermaid
flowchart TD
  Client --> Resolver[UserResolver]
  Resolver --> Service[UserService]
  Service --> UserRepo[(users)]
  Service --> ProviderRepo[(email_providers)]
  Service --> MailboxRepo[(mailboxes)]
  Service --> WorkspaceRepo[(workspace_members)]
  Service --> SubRepo[(user_subscriptions)]
  Service --> InvoiceRepo[(billing_invoices)]
  Service --> NotificationRepo[(user_notifications)]
  Service --> Resolver
  Resolver --> Client
```

## Notes

- Export payload intentionally includes metadata only (no provider tokens or
  encrypted secrets).
- Export is designed for legal portability requests and operational audits.
