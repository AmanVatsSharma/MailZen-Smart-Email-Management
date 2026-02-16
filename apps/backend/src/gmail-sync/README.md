# Gmail Sync Module (Backend)

## Goal

Sync **received Gmail messages** into Postgres so the frontend can render an inbox-like experience.

This module stores messages in `ExternalEmailMessage` (TypeORM entity) and supports:

- trigger sync
- fetch synced messages (legacy list API)
- sync provider label metadata (for UI labels)
- incremental sync using stored Gmail `historyId` cursor with fallback to full sync
- process Gmail Pub/Sub push webhook notifications for near-real-time incremental sync
- renew Gmail Pub/Sub watch subscriptions before expiration

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

`GmailSyncScheduler` publishes `SYNC_FAILED` domain events through
`NotificationEventBusService`, with metadata including:

- `providerId`
- `providerType`
- `workspaceId` (when available)
- `attempts` (number of retry attempts exhausted)

Scheduler hardening features:

- provider-level DB lease (`email_providers.syncLeaseExpiresAt`) to prevent duplicate workers
- retry with backoff (`GMAIL_SYNC_SCHEDULER_RETRIES`, `GMAIL_SYNC_SCHEDULER_RETRY_BACKOFF_MS`)
- per-provider jitter (`GMAIL_SYNC_SCHEDULER_JITTER_MS`) to reduce thundering-herd traffic
- duplicate failure notification suppression when error signature is unchanged
- emits `SYNC_RECOVERED` when Gmail sync succeeds after prior provider error
- sync lifecycle telemetry:
  - success updates `lastSyncedAt`
  - failures persist `lastSyncError` and `lastSyncErrorAt`
  - fresh sync start clears stale error state
- dedicated cron (`15 */6 * * *`) refreshes Gmail push watch subscriptions when topic is configured
- structured sync lifecycle logs (`gmail_sync_start`, `gmail_sync_batch_loaded`,
  `gmail_sync_message_import_failed`, `gmail_sync_completed`, `gmail_sync_failed`)
  include correlation id and duration metadata for observability triage
- structured Gmail resilience/push events:
  - `gmail_sync_access_token_refresh_failed`
  - `gmail_sync_labels_completed`
  - `gmail_sync_labels_failed`
  - `gmail_sync_profile_history_id_read_failed`
  - `gmail_sync_history_cursor_expired`
  - `gmail_sync_history_lookup_failed_fallback`
  - `gmail_sync_watch_renewed`
  - `gmail_sync_watch_renew_failed`
  - `gmail_push_notification_ignored_no_provider`
  - `gmail_push_notification_provider_failed`
  - `gmail_sync_resolver_audit_log_write_failed`
- structured scheduler logs (`gmail_sync_scheduler_start`,
  `gmail_sync_scheduler_retry`, `gmail_sync_scheduler_provider_failed`,
  `gmail_sync_watch_refresh_start`, `gmail_sync_watch_refresh_failed`) provide
  run-level retry and lease-skip diagnostics

## Compliance / Audit Trail

- Persisted audit actions:
  - `gmail_sync_requested`
  - `gmail_sync_request_failed`

## Push webhook endpoint

- `POST /gmail-sync/webhooks/push`
  - expects Google Pub/Sub push envelope body:
    - `message.data` = base64 JSON containing `emailAddress` and `historyId`
  - optional query auth token:
    - `?token=<value>`
    - validated against `GMAIL_PUSH_WEBHOOK_TOKEN` when configured
  - route resolves matching active Gmail providers by email and triggers
    lease-guarded `processPushNotification` sync path.
  - structured webhook events:
    - `gmail_push_webhook_secret_missing`
    - `gmail_push_webhook_secret_mismatch`
    - `gmail_push_webhook_processed`

Push tuning env vars:

- `GMAIL_PUSH_WEBHOOK_TOKEN` (optional shared secret query token)
- `GMAIL_PUSH_SYNC_MAX_MESSAGES` (default `25`, clamped `1..200`)
- `GMAIL_PUSH_TOPIC_NAME` (required to enable Gmail watch renewals)
- `GMAIL_PUSH_WATCH_RENEW_THRESHOLD_MINUTES` (default `60`)
- `GMAIL_PUSH_WATCH_LABEL_IDS` (default `INBOX`, comma-separated)

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
  sync --> lease[ProviderSyncLeaseService]
  lease --> db
  ui -->|Query emails/email| inboxGql[UnifiedInboxResolver]
  inboxGql --> db
```
