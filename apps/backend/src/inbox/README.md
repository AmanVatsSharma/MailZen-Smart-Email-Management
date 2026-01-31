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
  api --> db[(Postgres/Prisma)]
  frontend -->|Mutation setActiveInbox(type,id)| api
  api -->|validate_ownership| db
  api -->|persist_activeInbox| db
```

## Notes

- Active selection is persisted on `User` (`activeInboxType`, `activeInboxId`).\n+- When selecting a provider inbox, we also set `EmailProvider.isActive=true` for UI consistency.\n+
