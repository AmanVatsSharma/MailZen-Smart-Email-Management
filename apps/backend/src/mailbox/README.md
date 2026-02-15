# Mailbox Module (Backend)

## Goal

Manage user-owned `@mailzen.com` aliases and provision mailbox credentials for the MailZen mail stack.

This module covers:
- alias handle validation + creation
- plan entitlement enforcement for mailbox count
- default workspace assignment for each new mailbox
- mailbox persistence in Postgres (`mailboxes` table)
- credential generation + encryption
- optional external mail-server provisioning API call
- inbound webhook ingestion for `@mailzen.com` mailbox delivery events

## Key files

- `mailbox.service.ts`
  - validates desired local part
  - enforces uniqueness for `localPart@mailzen.com`
  - creates mailbox row and triggers provisioning
- `mail-server.service.ts`
  - generates mailbox password
  - optionally calls external admin API (`MAILZEN_MAIL_ADMIN_API_URL`)
  - encrypts password using `SECRETS_KEY`
  - stores SMTP/IMAP connection fields on mailbox row
- `mailbox.resolver.ts`
  - GraphQL:
    - `createMyMailbox(desiredLocalPart?: String): String!`
    - `myMailboxes(workspaceId?: String): [String!]!`
- `mailbox-inbound.controller.ts`
  - REST:
    - `POST /mailbox/inbound/events`
  - validates webhook auth token + payload and stores inbound message rows
- `mailbox-inbound.service.ts`
  - resolves mailbox owner/workspace
  - enforces mailbox status/quota guardrails before persisting
  - persists inbound payload in `emails` table with `status=NEW`
  - updates mailbox `usedBytes`
  - emits `MAILBOX_INBOUND` notification metadata context

## Provisioning flow

```mermaid
flowchart TD
  UI[Alias selection UI] --> GQL[createMyMailbox]
  GQL --> Service[MailboxService.createMailbox]
  Service --> DB1[(mailboxes insert)]
  Service --> Provision[MailServerService.provisionMailbox]
  Provision --> API{MAILZEN_MAIL_ADMIN_API_URL configured?}
  API -->|yes| AdminAPI[POST /mailboxes admin API]
  API -->|no| Skip[Local dev fallback mode]
  Provision --> Encrypt[Encrypt generated password with SECRETS_KEY]
  Encrypt --> DB2[(mailboxes update creds + hosts)]
  DB2 --> Done[Mailbox ready]
```

## Environment variables

### Required for secure production
- `SECRETS_KEY`
  - minimum 32 chars
  - used for AES-256-GCM mailbox credential encryption
  - production boot should provide strong key material

### Optional external mailbox provisioning
- `MAILZEN_MAIL_ADMIN_API_URL`
  - when set, service calls `${MAILZEN_MAIL_ADMIN_API_URL}/mailboxes`
- `MAILZEN_MAIL_ADMIN_API_TOKEN`
  - optional bearer token for admin API
- `MAILZEN_MAIL_ADMIN_API_TIMEOUT_MS` (default `5000`)

### Inbound webhook authentication
- `MAILZEN_INBOUND_WEBHOOK_TOKEN`
  - shared secret expected in `x-mailzen-inbound-token` header
  - production requires this to be configured
  - non-production allows local bypass with warning logs
- `MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY`
  - optional HMAC-SHA256 signing key
  - when configured, request must include:
    - `x-mailzen-inbound-timestamp`
    - `x-mailzen-inbound-signature`
- `MAILZEN_INBOUND_WEBHOOK_SIGNATURE_TOLERANCE_MS` (default `300000`)
  - allowed timestamp drift window for signed webhook replay protection
- `MAILZEN_INBOUND_IDEMPOTENCY_TTL_MS` (default `86400000`)
  - in-memory deduplication retention window for repeated `messageId` events

### Mail connection defaults persisted on mailbox rows
- `MAILZEN_SMTP_HOST` (default `smtp.mailzen.local`)
- `MAILZEN_SMTP_PORT` (default `587`)
- `MAILZEN_IMAP_HOST` (default `imap.mailzen.local`)
- `MAILZEN_IMAP_PORT` (default `993`)

## Error handling behavior

- If external admin API is configured and provisioning call fails:
  - throws `InternalServerErrorException`
  - mailbox credential persistence is skipped
- If mailbox row update fails (`affected=0`):
  - throws `InternalServerErrorException`
- If `SECRETS_KEY` is missing/short:
  - production: throws `InternalServerErrorException`
  - non-production: logs warning and uses local fallback key
- If inbound target mailbox is suspended or exceeds quota:
  - throws `BadRequestException`
  - inbound email is not persisted
- If webhook signature is configured and invalid/expired:
  - throws `UnauthorizedException`
- If duplicate `messageId` arrives inside idempotency cache window:
  - request is accepted and marked deduplicated without writing duplicate email row

## Notes

- This module provisions credentials and metadata; full inbound mailbox ingestion pipeline is handled by inbox/sync modules.
- Keep `SECRETS_KEY` managed via secure secret store in production.

## Inbound ingestion flow

```mermaid
sequenceDiagram
  participant MailInfra as Mail Server / Inbound Worker
  participant API as MailboxInboundController
  participant SVC as MailboxInboundService
  participant DB as Postgres
  participant Notif as NotificationService

  MailInfra->>API: POST /mailbox/inbound/events + x-mailzen-inbound-token
  API->>SVC: ingestInboundEvent(payload, authHeaders)
  SVC->>SVC: verify token/signature + replay window
  SVC->>DB: mailboxes.findOne(email)
  SVC->>SVC: dedupe by messageId cache
  SVC->>DB: emails.insert(status=NEW)
  SVC->>DB: mailboxes.update(usedBytes)
  SVC->>Notif: createNotification(type=MAILBOX_INBOUND)
  SVC-->>API: accepted + emailId/mailboxId
  API-->>MailInfra: 202 Accepted
```

## Operational runbook: signed webhook test (curl)

1) Generate signature payload:

```bash
npm run mailbox:inbound:signature -- \
  --mailboxEmail "sales@mailzen.com" \
  --from "lead@example.com" \
  --messageId "<lead-1001@example.com>" \
  --subject "New lead"
```

2) Use generated `timestamp` + `signature`:

```bash
curl -i -X POST "http://localhost:4000/mailbox/inbound/events" \
  -H "content-type: application/json" \
  -H "x-mailzen-inbound-token: ${MAILZEN_INBOUND_WEBHOOK_TOKEN}" \
  -H "x-mailzen-inbound-timestamp: <timestamp>" \
  -H "x-mailzen-inbound-signature: <signature>" \
  -d '{
    "mailboxEmail": "sales@mailzen.com",
    "from": "lead@example.com",
    "subject": "New lead",
    "textBody": "Hello from signed webhook",
    "messageId": "<lead-1001@example.com>"
  }'
```

## Staging verification checklist (inbound rollout)

- [ ] `MAILZEN_INBOUND_WEBHOOK_TOKEN` configured and rotated in secret store.
- [ ] `MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY` configured in backend + upstream sender.
- [ ] Positive test: signed inbound webhook returns `202` and creates one `NEW` email.
- [ ] Replay test: same `messageId` returns `202` with `deduplicated=true`, without new email row.
- [ ] Negative test: invalid signature returns `401`.
- [ ] Negative test: stale timestamp beyond tolerance returns `401`.
- [ ] Notification feed shows `MAILBOX_INBOUND` entry with mailbox/workspace metadata.

