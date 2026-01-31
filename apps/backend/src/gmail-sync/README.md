# Gmail Sync Module (Backend)

## Goal

Sync **received Gmail messages** into Postgres so the frontend can render an inbox-like experience.

This module stores messages in `ExternalEmailMessage` (Prisma model) and exposes GraphQL queries/mutations to:\n+- trigger sync\n+- fetch synced messages\n+\n+## Required Google scopes

For inbox sync, your Google OAuth consent must include at least:
- `https://www.googleapis.com/auth/gmail.readonly`

If you also want SMTP send via OAuth (nodemailer), you may use the broader:\n+- `https://mail.google.com/`\n+\n+## GraphQL API

- `syncGmailProvider(providerId: String!, maxMessages: Int): Boolean!`\n+- `getInboxMessages(inboxType: String!, inboxId: String!, limit: Int, offset: Int): [InboxMessage!]!`\n+\n+Notes:\n+- MVP supports `inboxType=\"PROVIDER\"` only.\n+\n+## Cron\n+\n+Active Gmail providers (`EmailProvider.isActive=true`) are synced every 10 minutes.\n+\n+## Mermaid flow\n+\n+```mermaid\n+flowchart TD\n+  ui[Frontend] -->|Mutation syncProvider| api[EmailProviderConnectResolver]\n+  api --> sync[GmailSyncService]\n+  sync -->|GmailAPI list+get| gmail[GmailAPI]\n+  sync --> db[(Postgres/Prisma)]\n+  ui -->|Query getInboxMessages| gql[GraphQL]\n+  gql --> db\n+```\n+
