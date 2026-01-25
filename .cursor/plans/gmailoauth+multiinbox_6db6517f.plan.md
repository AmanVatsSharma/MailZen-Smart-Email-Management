---
name: GmailOAuth+MultiInbox
overview: Add Google OAuth code-flow login, implement multi-inbox (internal mailzen + external providers) switching, and add Gmail inbox sync so users can view their real Gmail messages.
todos:
  - id: oauth-login
    content: Implement backend Google OAuth code-flow login endpoints, user upsert, JWT+refresh issuance, and auth docs/diagram.
    status: in_progress
  - id: provider-connect
    content: Add backend mutations for connectGmail/connectOutlook/connectSmtp + token exchange and align GraphQL with frontend provider-utils expectations.
    status: pending
    dependencies:
      - oauth-login
  - id: inbox-switch
    content: Add unified inbox API (myInboxes + setActiveInbox) and persist active selection in Prisma.
    status: pending
    dependencies:
      - provider-connect
  - id: gmail-sync
    content: Implement Gmail API sync pipeline (DB model, sync service, queue/cron, queries) so users can view real Gmail inbox messages.
    status: pending
    dependencies:
      - inbox-switch
---

# Gmail OAuth Login + Multi-Inbox + Gmail Sync Plan

## What we’ll deliver (MVP → solid baseline)

- **Google OAuth code-flow login**: any user can sign in with Google, backend exchanges `code` and issues our **JWT + refresh token**.
- **Unified inbox identity**: users can have **multiple internal `@mailzen.com` mailboxes** and **multiple external providers** (Gmail/Outlook/SMTP). Backend exposes a single “inboxes” list + an “active inbox” setting.
- **Gmail message sync (receive)**: backend pulls Gmail messages via Gmail API into DB so the UI can show “their real mails like Gmail”.

## Key repo reality (so scope is accurate)

- Backend already has JWT auth (`backend/src/auth/*`) and email provider storage/refresh (`backend/src/email-integration/email-provider.service.ts`).
- Backend currently supports **sending** email but does **not** implement IMAP/Gmail API inbox fetching (only a placeholder IMAP host in `backend/src/mailbox/mail-server.service.ts`).

## Implementation steps (files we’ll change/add)

### 1) Google OAuth login (code-flow handled by backend)

- **Add REST endpoints** in a new controller (e.g. `backend/src/auth/oauth.controller.ts`) because OAuth redirects are much cleaner over HTTP than GraphQL:
  - `GET /auth/google/start`: builds Google auth URL (scopes for login + optional Gmail) and redirects.
  - `GET /auth/google/callback`: validates `state`, exchanges `code` for tokens, fetches Google user profile (`userinfo.email`), upserts `User`, then issues JWT + refresh token.
  - Redirect to frontend with success (e.g. `FRONTEND_URL/auth/oauth-success?token=...&refreshToken=...`) **or** set `HttpOnly` cookies (preferred; we’ll pick one consistent with current frontend localStorage behavior).
- **Add robust logging + audit logs**:
  - Use `Logger` in controller/service; write an `AuditLog` record on login success/failure.
- **Docs**: add `backend/src/auth/README.md` section “Google OAuth Login Flow” + a mermaid diagram.

### 2) Provider OAuth code exchange (connect Gmail/Outlook properly)

Frontend already generates OAuth URLs and receives `code` in `frontend/app/api/auth/google/callback/route.ts`, but it’s a stub.

- **Add GraphQL mutations** that frontend expects (currently only defined client-side):
  - `connectGmail(code: String!): EmailProvider`
  - `connectOutlook(code: String!): EmailProvider`
  - `connectSmtp(settings: SmtpSettingsInput!): EmailProvider`
  - `updateProvider(id, isActive)` / `disconnectProvider` / `syncProvider` as needed to match `frontend/lib/providers/provider-utils.ts`
- In `backend/src/email-integration/` add a small OAuth exchange helper:
  - Gmail: use `google-auth-library` `OAuth2Client.getToken(code)`.
  - Outlook: exchange code via Microsoft token endpoint.
- **Store refresh token + expiry** in `EmailProvider` (already supported by schema), and ensure we never expose secrets in GraphQL entities.
- **Docs**: update `backend/src/email-integration/README.md` to include the new “connect via code” mutations and flow diagram.

### 3) Multi-inbox model + “active inbox” switching

We need one selector that can switch between:

- Internal MailZen mailboxes (`Mailbox` model)
- External providers (`EmailProvider` model)

Backend changes:

- **Prisma schema update** in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma):
  - Add `User.activeInboxType` (`MAILBOX` | `PROVIDER`) and `User.activeInboxId` (string), or two nullable fields (`activeMailboxId`, `activeProviderId`).
  - Add provider/mailbox “display metadata” fields if needed (`lastSyncedAt`, `status`, etc.).
- **New GraphQL API** (new module `backend/src/inbox/`):
  - `myInboxes`: returns a union-like DTO (e.g. `Inbox { id, type, address, status, isActive }`).
  - `setActiveInbox(type, id)`: persists selection on `User`.
- **Update existing email queries** to accept an optional filter:
  - `getMyEmails(inboxType?, inboxId?)` and default to active inbox.

Docs:

- `backend/src/inbox/README.md` with a mermaid flowchart and examples.

### 4) Gmail “receive/sync” so users can actually see Gmail inbox

Because there’s no IMAP/Gmail fetching today, we add a Gmail sync pipeline.

- **Add dependency**: `googleapis` (or call Gmail REST directly; `googleapis` is simpler).
- **DB models** (Prisma): add a new table to store inbound Gmail messages without breaking existing `Email` semantics:
  - `ExternalEmailMessage` (providerId, externalMessageId, threadId, from, to, subject, snippet, internalDate, rawPayloadJson, labelsJson, etc.)
  - Optional: link to existing `Email` if you want a single list later.
- **Sync service** (new module `backend/src/gmail-sync/`):
  - `syncGmailProvider(providerId, userId)`
  - Use provider’s stored tokens; refresh if needed (reuse existing refresh logic).
  - Fetch message IDs + metadata incrementally (store `gmailHistoryId`/cursor per provider).
- **Queue + cron**:
  - Reuse Bull/Schedule already present (`@nestjs/bull`, `@nestjs/schedule`).
  - Add a periodic job to sync active providers and an on-demand `syncProvider(id)` mutation.
- **GraphQL queries** for UI:
  - `getInboxMessages(inboxType, inboxId, pagination, folder/label)` returning a normalized list for inbox UI.

Docs:

- `backend/src/gmail-sync/README.md` with setup steps, required Google scopes, and troubleshooting.

## Mermaid: end-to-end flow (login + connect + switch + sync)

```mermaid
flowchart TD
  user[User] --> frontend[Frontend]
  frontend -->|GET /auth/google/start| backendAuth[BackendAuth]
  backendAuth -->|redirect_to_google| google[GoogleOAuth]
  google -->|code+state| backendCallback[BackendCallback]
  backendCallback -->|exchange_code_for_tokens| google
  backendCallback -->|issue_JWT+refresh| frontend
  frontend -->|configure/connect_provider| backendProvider[EmailProviderModule]
  backendProvider --> db[(Postgres/Prisma)]
  frontend -->|setActiveInbox| backendInbox[InboxModule]
  backendInbox --> db
  backendSync[GmailSyncModule] -->|cron_or_on_demand| google
  backendSync --> db
  frontend -->|getInboxMessages(active)| backendAPI[GraphQL]
  backendAPI --> db
```

## Notes on robustness (per your rules)

- **Error handling**: explicit validation for missing env vars, invalid `state`, expired codes, token refresh failures, provider ownership checks.
- **Logs**: Nest `Logger` in each service/controller + structured `AuditLog` writes.
- **Comments + docs**: inline comments for flows + module READMEs updated/added; diagrams live in each module’s README.

## Deliverables checklist (what you’ll see after)

- Login with Google works end-to-end and returns JWT.
- User can connect multiple Gmail/Outlook/SMTP accounts.
- User can create multiple `@mailzen.com` mailboxes and switch between internal/external inboxes.
- Gmail messages are synced into DB and visible via new inbox message query.