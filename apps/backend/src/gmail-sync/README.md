# Gmail Sync Module (Backend)

## Goal

Sync **received Gmail messages** into Postgres so the frontend can render an inbox-like experience.

This module stores messages in `ExternalEmailMessage` (TypeORM entity) and supports:
- trigger sync
- fetch synced messages (legacy list API)
- sync provider label metadata (for UI labels)
- incremental sync using stored Gmail `historyId` cursor with fallback to full sync

## Required Google scopes

For inbox sync, your Google OAuth consent must include at least:
- `https://www.googleapis.com/auth/gmail.readonly`

If you also want SMTP send via OAuth (nodemailer), you may use the broader:
- `https://mail.google.com/`

## GraphQL API

- `syncGmailProvider(providerId: String!, maxMessages: Int): Boolean!`
- `getInboxMessages(inboxType: String!, inboxId: String!, limit: Int, offset: Int): [InboxMessage!]!`

Notes:
- MVP supports `inboxType="PROVIDER"` only.
- The unified inbox UI primarily uses `UnifiedInboxModule` (`emails/email/updateEmail/...`) rather than `getInboxMessages`.

## Label metadata sync

On each `syncGmailProvider`, we best-effort sync Gmail labels into `ExternalEmailLabel` so the UI can render human label names and colors.

## Scheduler failure notification context

`GmailSyncScheduler` emits `SYNC_FAILED` notifications with metadata including:
- `providerId`
- `providerType`
- `workspaceId` (when available)

## Incremental cursor behavior

- `EmailProvider.gmailHistoryId` is used as the preferred sync cursor.
- If cursor is present, sync calls Gmail `users.history.list` and imports changed message IDs.
- If cursor is missing or expired (e.g. history 404), service falls back to full `messages.list` sync.
- After each successful sync, provider cursor is refreshed from Gmail response/profile history id.

## Mermaid: provider sync

```mermaid
flowchart TD
  ui[Frontend] -->|Mutation syncProvider| api[EmailProviderConnectResolver]
  api --> sync[GmailSyncService]
  sync -->|GmailAPI labels.list| gmailLabels[GmailAPI]
  sync --> db[(PostgresTypeORM)]
  sync -->|GmailAPI messages.list+messages.get(metadata)| gmailMsgs[GmailAPI]
  ui -->|Query emails/email| inboxGql[UnifiedInboxResolver]
  inboxGql --> db
```
