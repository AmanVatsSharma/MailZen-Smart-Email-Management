# Inbox Module (Backend)

## Goal

Provide a single API for **multi-inbox switching**, combining:
- Internal MailZen mailboxes (`Mailbox`)
- External connected providers (`EmailProvider`)

## GraphQL API

- `myInboxes: [Inbox!]!`
- `setActiveInbox(input: SetActiveInboxInput!): [Inbox!]!`

## Flow

```mermaid
flowchart TD
  frontend[FrontendInboxSwitcher] -->|Query myInboxes| api[GraphQL InboxResolver]
  api --> db[(PostgresTypeORM)]
  frontend -->|Mutation setActiveInbox(type,id)| api
  api -->|validate_ownership| db
  api -->|persist_activeInbox| db
```

## Notes

- Active selection is persisted on `User` (`activeInboxType`, `activeInboxId`).
- Listing/switching is now scoped by `User.activeWorkspaceId` when present.
- Workspace activation is managed by `WorkspaceModule` (`myActiveWorkspace`, `setActiveWorkspace`).
- When selecting a provider inbox, we also set `EmailProvider.isActive=true` for UI consistency.

## Relation to Unified Inbox

The unified inbox UI uses this module to determine the active provider inbox (or mailbox) and then fetches messages via `UnifiedInboxModule` (`emails/email/updateEmail/folders/labels`).
