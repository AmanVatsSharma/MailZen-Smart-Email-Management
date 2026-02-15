# Notification Module (Backend)

## Goal

Provide a persistent notification foundation for user-visible product events
(starting with provider sync failures).

## Responsibilities

- Persist user notifications in Postgres (`user_notifications`)
- Persist user notification preferences (`user_notification_preferences`)
- Provide domain-event abstraction (`NotificationEventBusService`) for modules
  emitting user-facing events
- Query notifications for current user
- Track unread notification count
- Mark notifications as read
- Provide reusable `createNotification` API for other backend modules
- Publish realtime notification stream events for in-app consumers
- Send periodic unread-notification digest emails for users with email channel enabled

## GraphQL API

- `myNotifications(limit, unreadOnly, workspaceId?, sinceHours?, types?)` → list recent
  notifications (optional workspace/time-window/type filtering)
  - workspace filtering returns both matching workspace notifications and
    global (`workspaceId = null`) notifications for complete operational context.
- `myMailboxInboundSlaIncidentStats(workspaceId?, windowHours?)` → aggregated
  warning/critical incident counts and last-alert timestamp for SLA alerts
- `myMailboxInboundSlaIncidentSeries(workspaceId?, windowHours?, bucketMinutes?)` →
  bucketed warning/critical incident trend points for dashboards
- `myUnreadNotificationCount(workspaceId?)` → unread badge count (workspace + global scope)
- `myNotificationPreferences` → get per-user notification channel settings
- `markNotificationRead(id)` → marks one notification as read
- `markMyNotificationsRead(workspaceId?, sinceHours?, types?)` → marks matching
  notifications as read in bulk (used by SLA incident acknowledgement)
- `updateMyNotificationPreferences(input)` → update channel + event preferences

## Realtime API

- `GET /notifications/stream?workspaceId=<optional>` (Server-Sent Events)
  - authenticated via `JwtAuthGuard` (cookie or bearer token)
  - emits event type `notification` with payload:
    - `NOTIFICATION_CREATED`
    - `NOTIFICATIONS_MARKED_READ`
  - emits event type `heartbeat` every 25s to keep clients connected
  - when `workspaceId` is provided, stream includes both:
    - matching workspace events
    - global events (`workspaceId = null`)

## Email digest scheduler

- `NotificationDigestScheduler` runs hourly (`0 * * * *`).
- For users with `emailEnabled=true`, it:
  - collects unread notifications since the last digest timestamp (or fallback window),
  - sends a concise digest email,
  - updates `notificationDigestLastSentAt` on success.
- If delivery fails, timestamp is not updated, so next scheduler run retries automatically.

Digest tuning env vars:
- `MAILZEN_NOTIFICATION_DIGEST_WINDOW_HOURS` (default `24`)
- `MAILZEN_NOTIFICATION_DIGEST_MAX_USERS_PER_RUN` (default `250`)
- `MAILZEN_NOTIFICATION_DIGEST_MAX_ITEMS` (default `8`)

## Initial event producers

- `GmailSyncScheduler` publishes `SYNC_FAILED` domain events through
  `NotificationEventBusService` on cron sync failure
- `OutlookSyncScheduler` publishes `SYNC_FAILED` domain events through
  `NotificationEventBusService` on cron sync failure
- `AiAgentGatewayService` publishes `AGENT_ACTION_REQUIRED` domain events for
  follow-up reminders
- `MailboxInboundSlaScheduler` publishes `MAILBOX_INBOUND_SLA_ALERT` domain
  events when mailbox
  inbound success/rejection rates breach user-configured thresholds
  - scheduler stores last alert status/timestamp to enforce cooldown and clear
    stale alert state on SLA recovery
- `NotificationDigestScheduler` emits digest emails (mailer channel) for unread events
- Emission respects stored user preferences:
  - `inAppEnabled`
  - `syncFailureEnabled`
  - `mailboxInboundAcceptedEnabled`
  - `mailboxInboundDeduplicatedEnabled`
  - `mailboxInboundRejectedEnabled`
  - mailbox inbound SLA thresholds:
    - `mailboxInboundSlaTargetSuccessPercent`
    - `mailboxInboundSlaWarningRejectedPercent`
    - `mailboxInboundSlaCriticalRejectedPercent`
  - `mailboxInboundSlaAlertsEnabled`
  - `mailboxInboundSlaAlertCooldownMinutes`

### Metadata conventions

Notification metadata is intentionally extensible. Current producers attach:
- Sync failures: `providerId`, `providerType`, `workspaceId`
- AI follow-up reminders: `threadId`, `followupAt`, `workspaceId`, `providerId`
- Mailbox inbound alerts:
  - `inboundStatus` (`ACCEPTED` | `DEDUPLICATED` | `REJECTED`)
  - `mailboxId`, `mailboxEmail`, `workspaceId`, `messageId`, `sourceIp`
  - optional `errorReason` and `emailId` for rejection/dedupe context
- Mailbox inbound SLA alerts:
  - `slaStatus` (`WARNING` | `CRITICAL`)
  - `successRatePercent`, `rejectionRatePercent`
  - `slaTargetSuccessPercent`, `slaWarningRejectedPercent`, `slaCriticalRejectedPercent`
  - `totalCount`, `acceptedCount`, `deduplicatedCount`, `rejectedCount`, `windowHours`

Notifications also persist `workspaceId` as a first-class column (derived from
metadata at write time) so workspace-scoped filtering is query-efficient.

## Flow

```mermaid
flowchart TD
  Scheduler[Provider Sync Scheduler] --> NotificationService
  Producer[Domain producer modules] --> NotificationEventBus
  NotificationEventBus --> NotificationService
  NotificationService --> Repo[(user_notifications table)]
  NotificationService --> RealtimeBus[(in-memory realtime event bus)]
  NotificationService --> DigestScheduler[Hourly unread digest scheduler]
  DigestScheduler --> Mailer[SMTP mailer channel]
  RealtimeBus --> NotificationStream[notifications/stream SSE]
  UserUI[Authenticated frontend] --> NotificationResolver
  UserUI --> NotificationStream
  NotificationResolver --> NotificationService
  NotificationService --> UserUI
```

