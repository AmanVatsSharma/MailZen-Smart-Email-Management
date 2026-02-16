# Inbox Module (Backend)

## Goal

Provide a single API for **multi-inbox switching**, combining:

- Internal MailZen mailboxes (`Mailbox`)
- External connected providers (`EmailProvider`)

## GraphQL API

- `myInboxes: [Inbox!]!`
- `setActiveInbox(input: SetActiveInboxInput!): [Inbox!]!`
- `syncMyInboxes(workspaceId?: String): InboxSyncRunResponse!`
  - triggers both mailbox pull sync + provider sync for authenticated user/workspace
  - returns aggregate counters and partial-failure fields (`mailboxSyncError`, `providerSyncError`)
- `myInboxSourceHealthStats(workspaceId?: String, windowHours?: Int): InboxSourceHealthStatsResponse!`
  - returns aggregate health buckets for mailbox + provider inbox sources
  - includes lifecycle counts (`connected/syncing/error/pending/disabled`),
    recent sync/error counts, active inbox count, and evaluated workspace scope

`Inbox` response now includes sync telemetry fields:

- `syncStatus`
  - provider: mirrors normalized provider lifecycle (`connected/syncing/error/...`)
  - mailbox: derived from mailbox status + lease + last error
- `lastSyncedAt`
  - provider: `EmailProvider.lastSyncedAt`
  - mailbox: `Mailbox.inboundSyncLastPolledAt`
- `lastSyncError`
  - provider: `EmailProvider.lastSyncError`
  - mailbox: `Mailbox.inboundSyncLastError`
- `lastSyncErrorAt`
  - provider: `EmailProvider.lastSyncErrorAt`
  - mailbox: `Mailbox.inboundSyncLastErrorAt`
- `sourceKind`
  - `MAILBOX` for internal alias inboxes
  - provider type for external inboxes (e.g. `GMAIL`, `OUTLOOK`)

## Flow

```mermaid
flowchart TD
  frontend[FrontendInboxSwitcher] -->|Query myInboxes| api[GraphQL InboxResolver]
  api --> db[(PostgresTypeORM)]
  frontend -->|Mutation setActiveInbox(type,id)| api
  frontend -->|Mutation syncMyInboxes| api
  frontend -->|Query myInboxSourceHealthStats| api
  api -->|validate_ownership| db
  api -->|persist_activeInbox| db
  api -->|aggregate lifecycle counts| db
```

## Notes

- Active selection is persisted on `User` (`activeInboxType`, `activeInboxId`).
- Listing/switching is now scoped by `User.activeWorkspaceId` when present.
- Workspace activation is managed by `WorkspaceModule` (`myActiveWorkspace`, `setActiveWorkspace`).
- When selecting a provider inbox, we also set `EmailProvider.isActive=true` for UI consistency.

## Relation to Unified Inbox

The unified inbox UI uses this module to determine the active provider inbox (or mailbox) and then fetches messages via `UnifiedInboxModule` (`emails/email/updateEmail/folders/labels`).
