# TypeORM Usage Guide

## Purpose

This guide documents the backend TypeORM setup and the standard patterns for
services, modules, and migrations.

## Configuration

- Runtime config: `src/database/typeorm.config.ts`
- CLI DataSource: `src/database/data-source.ts`
- Migration folder: `src/database/migrations`

### Runtime Rules

- Local development can use schema sync.
- Non-local environments must use migrations.
- `DATABASE_URL` is required.

## Module Pattern

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([EmailProvider, ExternalEmailMessage])],
  providers: [MyService, MyResolver],
  exports: [MyService],
})
export class MyModule {}
```

## Service Pattern

```typescript
@Injectable()
export class MyService {
  constructor(
    @InjectRepository(MyEntity)
    private readonly myEntityRepo: Repository<MyEntity>,
  ) {}

  async listForUser(userId: string) {
    return this.myEntityRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
```

## Query Patterns

### Find one

```typescript
await userRepo.findOne({ where: { id } });
```

### Create + save

```typescript
const entity = repo.create(payload);
return repo.save(entity);
```

### Update

```typescript
await repo.update(id, { status: 'ACTIVE' });
```

### Delete

```typescript
await repo.delete(id);
```

### Relations

```typescript
await emailRepo.find({
  where: { userId },
  relations: ['provider', 'analytics'],
});
```

### QueryBuilder

```typescript
return messageRepo
  .createQueryBuilder('m')
  .where('m.userId = :userId', { userId })
  .orderBy('m.internalDate', 'DESC')
  .take(limit)
  .skip(offset)
  .getMany();
```

## Migration Commands

```bash
# Create empty migration
npm run migration:create --name=add-email-index

# Generate from entity changes
npm run migration:generate --name=email-schema-update

# Apply
npm run migration:run

# Revert last
npm run migration:revert

# Show status
npm run migration:show
```

## Production Checklist

- `synchronize` disabled
- migrations reviewed and committed
- migration run validated in CI
- build + test passing before deploy

## Workspace Scope Rollout Notes (2026-02-15)

New migration: `20260215161000-workspace-scoping-and-entitlements.ts`

This migration introduces:

- `workspaces` table
- `workspace_members` table
- `users.activeWorkspaceId`
- `email_providers.workspaceId`
- `mailboxes.workspaceId`
- `billing_plans.workspaceLimit`

### Safe rollout sequence

1. Deploy backend image containing migration and code.
2. Run `npm run migration:run` before shifting traffic.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run check:schema:contracts`
   - `npm run build`
5. Run backfill command for existing users/resources:
   - default dry run: `npm run backfill:workspace-scopes`
   - apply changes: `npm run backfill:workspace-scopes:apply`
6. Verify workspace-aware GraphQL paths:
   - `myWorkspaces`
   - `myActiveWorkspace`
   - `setActiveWorkspace`
   - `providers(workspaceId)`
   - `myMailboxes(workspaceId)`

### Staging verification SQL (post-backfill)

Run these in staging DB to verify backfill outcomes:

```sql
-- Users should have active workspace after backfill
SELECT COUNT(*) AS users_without_active_workspace
FROM users
WHERE "activeWorkspaceId" IS NULL;

-- Providers/mailboxes should be workspace-tagged
SELECT COUNT(*) AS providers_without_workspace
FROM email_providers
WHERE "workspaceId" IS NULL;

SELECT COUNT(*) AS mailboxes_without_workspace
FROM mailboxes
WHERE "workspaceId" IS NULL;

-- Personal workspace cardinality sanity check (one personal per user expected)
SELECT "ownerUserId", COUNT(*) AS personal_workspace_count
FROM workspaces
WHERE "isPersonal" = true
GROUP BY "ownerUserId"
HAVING COUNT(*) > 1;
```

## Mailbox Inbound Threading Rollout Notes (2026-02-15)

New migration: `20260215193000-mailbox-inbound-threading.ts`

This migration introduces:

- `emails.inboundMessageId` (nullable, indexed)
- `emails.inboundThreadKey` (nullable, indexed)

### Safe rollout sequence

1. Deploy backend image containing migration and webhook ingestion code.
2. Run `npm run migration:run` before enabling inbound webhook traffic.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run check:schema:contracts`
   - `npm run build`
5. Run mailbox inbound signed webhook smoke (see mailbox module runbook).
6. Verify inbox notification + email row behavior:
   - duplicate `messageId` stays idempotent
   - new message writes `inboundMessageId` and `inboundThreadKey`

## Mailbox Inbound Event Store Rollout Notes (2026-02-15)

New migration: `20260215202000-mailbox-inbound-events.ts`

This migration introduces:

- `mailbox_inbound_events` table for inbound webhook idempotency + observability
- unique key on `("mailboxId","messageId")`
- indexes on mailbox/user/message/email identifiers

### Safe rollout sequence

1. Deploy backend containing event-store migration + service code.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run mailbox webhook smoke scenarios:
   - first event -> `status=ACCEPTED`
   - repeated message-id -> deduplicated path
   - invalid signature -> rejected path

### Staging verification SQL (inbound events)

```sql
-- Ensure event store receives entries
SELECT status, COUNT(*) AS total
FROM mailbox_inbound_events
GROUP BY status
ORDER BY status;

-- Spot duplicate message-id handling correctness
SELECT "mailboxId", "messageId", COUNT(*) AS duplicates
FROM mailbox_inbound_events
WHERE "messageId" IS NOT NULL
GROUP BY "mailboxId", "messageId"
HAVING COUNT(*) > 1;
```

## Notification Mailbox Inbound Preference Rollout Notes (2026-02-16)

New migration: `20260216001000-notification-mailbox-inbound-preferences.ts`

This migration introduces:

- `user_notification_preferences.mailboxInboundAcceptedEnabled`
- `user_notification_preferences.mailboxInboundDeduplicatedEnabled`
- `user_notification_preferences.mailboxInboundRejectedEnabled`

### Safe rollout sequence

1. Deploy backend containing notification preference migration + notification service updates.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- notification/notification.service.spec.ts`
   - `npm run build`
5. Verify UI/API preference paths:
   - `myNotificationPreferences`
   - `updateMyNotificationPreferences`

### Staging verification SQL (notification preference defaults)

```sql
SELECT
  COUNT(*) FILTER (WHERE "mailboxInboundAcceptedEnabled" = true) AS accepted_enabled,
  COUNT(*) FILTER (WHERE "mailboxInboundDeduplicatedEnabled" = false) AS dedupe_default_disabled,
  COUNT(*) FILTER (WHERE "mailboxInboundRejectedEnabled" = true) AS rejected_enabled
FROM user_notification_preferences;
```

## Notification Mailbox Inbound SLA Threshold Rollout Notes (2026-02-16)

New migration: `20260216003000-notification-mailbox-inbound-sla-thresholds.ts`

This migration introduces:

- `user_notification_preferences.mailboxInboundSlaTargetSuccessPercent`
- `user_notification_preferences.mailboxInboundSlaWarningRejectedPercent`
- `user_notification_preferences.mailboxInboundSlaCriticalRejectedPercent`

### Safe rollout sequence

1. Deploy backend containing SLA threshold preference migration + mailbox stats updates.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- notification/notification.service.spec.ts mailbox/mailbox.service.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Verify UI/API threshold flows:
   - `myNotificationPreferences`
   - `updateMyNotificationPreferences`
   - `myMailboxInboundEventStats` (`sla*` fields should reflect persisted preferences)

### Staging verification SQL (SLA threshold defaults and ordering)

```sql
SELECT
  COUNT(*) FILTER (WHERE "mailboxInboundSlaTargetSuccessPercent" = 99) AS target_default_count,
  COUNT(*) FILTER (WHERE "mailboxInboundSlaWarningRejectedPercent" = 1) AS warning_default_count,
  COUNT(*) FILTER (WHERE "mailboxInboundSlaCriticalRejectedPercent" = 5) AS critical_default_count
FROM user_notification_preferences;

SELECT
  COUNT(*) AS invalid_threshold_rows
FROM user_notification_preferences
WHERE "mailboxInboundSlaWarningRejectedPercent" > "mailboxInboundSlaCriticalRejectedPercent";
```

## Notification Mailbox Inbound SLA Alert-State Rollout Notes (2026-02-16)

New migration: `20260216005000-notification-mailbox-inbound-sla-alert-state.ts`

This migration introduces:

- `user_notification_preferences.mailboxInboundSlaAlertsEnabled`
- `user_notification_preferences.mailboxInboundSlaLastAlertStatus`
- `user_notification_preferences.mailboxInboundSlaLastAlertedAt`

### Safe rollout sequence

1. Deploy backend containing alert-state migration + mailbox SLA scheduler.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- mailbox/mailbox-inbound-sla.scheduler.spec.ts notification/notification.service.spec.ts`
   - `npm run build`
5. Verify operational behavior:
   - `MAILBOX_INBOUND_SLA_ALERT` notifications emit on WARNING/CRITICAL transitions
   - duplicate same-status alerts are suppressed during cooldown window
   - healthy/no-data states clear stored alert status

### Staging verification SQL (SLA alert-state columns)

```sql
SELECT
  COUNT(*) FILTER (WHERE "mailboxInboundSlaAlertsEnabled" = true) AS alerts_enabled_rows,
  COUNT(*) FILTER (WHERE "mailboxInboundSlaLastAlertStatus" IS NOT NULL) AS rows_with_alert_status
FROM user_notification_preferences;
```

## Notification Workspace Scope Rollout Notes (2026-02-16)

New migration: `20260216009000-notification-workspace-scope.ts`

This migration introduces:

- `user_notifications.workspaceId`
- index: `IDX_user_notifications_workspaceId`

### Safe rollout sequence

1. Deploy backend containing workspace-scoped notification query updates.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- notification/notification.service.spec.ts notification/notification.resolver.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Verify workspace-scoped notifications behavior:
   - emit any notification with `metadata.workspaceId`
   - query `myNotifications(workspaceId: "...")` and validate filtered results

### Staging verification SQL (notification workspace population)

```sql
SELECT
  COUNT(*) AS total_notifications,
  COUNT(*) FILTER (WHERE "workspaceId" IS NOT NULL) AS workspace_tagged_notifications
FROM user_notifications;
```

## Notification Mailbox Inbound SLA Cooldown Rollout Notes (2026-02-16)

New migration: `20260216011000-notification-mailbox-inbound-sla-cooldown.ts`

This migration introduces:

- `user_notification_preferences.mailboxInboundSlaAlertCooldownMinutes`

### Safe rollout sequence

1. Deploy backend containing cooldown preference migration + scheduler preference resolution.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- mailbox/mailbox-inbound-sla.scheduler.spec.ts notification/notification.service.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Verify UI/API cooldown flows:
   - `myNotificationPreferences`
   - `updateMyNotificationPreferences`
   - confirm duplicate SLA alerts are suppressed according to user-configured cooldown

### Staging verification SQL (cooldown defaults + constraints)

```sql
SELECT
  COUNT(*) FILTER (WHERE "mailboxInboundSlaAlertCooldownMinutes" = 60) AS cooldown_default_rows,
  COUNT(*) FILTER (WHERE "mailboxInboundSlaAlertCooldownMinutes" < 1) AS invalid_low_rows,
  COUNT(*) FILTER (WHERE "mailboxInboundSlaAlertCooldownMinutes" > 1440) AS invalid_high_rows
FROM user_notification_preferences;
```

## Notification Digest Last-Sent Rollout Notes (2026-02-16)

New migration: `20260216013000-notification-digest-last-sent.ts`

This migration introduces:

- `user_notification_preferences.notificationDigestLastSentAt`

### Safe rollout sequence

1. Deploy backend containing digest scheduler + migration.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- notification/notification-digest.scheduler.spec.ts notification/notification.service.spec.ts`
   - `npm run build`
5. Verify digest behavior:
   - users with unread notifications and `emailEnabled=true` receive digest email
   - `notificationDigestLastSentAt` is updated only after successful email send

### Staging verification SQL (digest tracking column)

```sql
SELECT
  COUNT(*) AS total_preferences,
  COUNT(*) FILTER (WHERE "notificationDigestLastSentAt" IS NOT NULL) AS digest_sent_rows
FROM user_notification_preferences;
```

## Notification Digest Enabled Preference Rollout Notes (2026-02-16)

New migration: `20260216015000-notification-digest-enabled.ts`

This migration introduces:

- `user_notification_preferences.notificationDigestEnabled`

### Safe rollout sequence

1. Deploy backend containing digest preference toggle support.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- notification/notification.service.spec.ts notification/notification-digest.scheduler.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Verify preference behavior:
   - `myNotificationPreferences` returns `notificationDigestEnabled`
   - `updateMyNotificationPreferences` updates digest toggle
   - digest scheduler skips users with `notificationDigestEnabled=false`

### Staging verification SQL (digest toggle defaults)

```sql
SELECT
  COUNT(*) FILTER (WHERE "notificationDigestEnabled" = true) AS digest_enabled_rows,
  COUNT(*) FILTER (WHERE "notificationDigestEnabled" = false) AS digest_disabled_rows
FROM user_notification_preferences;
```

## Notification Push Subscription Rollout Notes (2026-02-16)

New migration: `20260216017000-notification-push-subscriptions.ts`

This migration introduces:

- `notification_push_subscriptions` table for per-user web push endpoints
- unique endpoint guard
- operational delivery telemetry fields (`failureCount`, `lastDeliveredAt`,
  `lastFailureAt`, `isActive`)

### Safe rollout sequence

1. Deploy backend containing notification push resolver/service support.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- notification/notification-push.service.spec.ts notification/notification.service.spec.ts notification/notification.resolver.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Verify runtime behavior:
   - `registerMyNotificationPushSubscription` upserts subscription row.
   - `myNotificationPushSubscriptions` returns workspace/global scoped rows.
   - push dispatch attempts occur for `NOTIFICATION_CREATED` events when:
     - `pushEnabled=true`
     - `MAILZEN_WEB_PUSH_ENABLED=true`
     - VAPID env values are configured.

### Staging verification SQL

```sql
SELECT
  COUNT(*) AS total_subscriptions,
  COUNT(*) FILTER (WHERE "isActive" = true) AS active_subscriptions,
  COUNT(*) FILTER (WHERE "failureCount" > 0) AS failing_subscriptions
FROM notification_push_subscriptions;
```

## Feature Targeted Rollout Columns Notes (2026-02-16)

New migration: `20260216019000-feature-targeted-rollout-columns.ts`

This migration introduces:

- `features.targetType` (`GLOBAL` default)
- `features.targetValue` (nullable scope selector)
- `features.rolloutPercentage` (integer default `100`)

### Safe rollout sequence

1. Deploy backend with updated feature entity/service/resolver logic.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- feature/feature.service.spec.ts feature/feature.resolver.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Verify GraphQL behavior:
   - `createFeature` and `updateFeature` support rollout fields.
   - `isFeatureEnabled` returns context-aware enablement values.

### Staging verification SQL

```sql
SELECT
  COUNT(*) AS total_features,
  COUNT(*) FILTER (WHERE "targetType" = 'GLOBAL') AS global_features,
  COUNT(*) FILTER (WHERE "rolloutPercentage" < 100) AS partial_rollout_features
FROM features;
```

## AI Agent Action Audits Rollout Notes (2026-02-16)

New migration: `20260216021000-agent-action-audits.ts`

This migration introduces:

- `agent_action_audits` table with per-action execution records
- request-level trace linkage (`requestId`) for operational forensics
- approval metadata (`approvalRequired`, `approvalTokenSuffix`)

### Safe rollout sequence

1. Deploy backend with AI gateway audit persistence support.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- ai-agent-gateway/ai-agent-gateway.service.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Validate runtime behavior:
   - executable agent actions append audit rows
   - rows include skill/action/executed and request correlation identifiers.

### Staging verification SQL

```sql
SELECT
  COUNT(*) AS total_agent_action_audits,
  COUNT(*) FILTER (WHERE "executed" = true) AS executed_actions,
  COUNT(*) FILTER (WHERE "approvalRequired" = true) AS approval_required_actions
FROM agent_action_audits;
```

## Provider Sync Lease Rollout Notes (2026-02-16)

New migration: `20260216023000-email-provider-sync-lease.ts`

This migration introduces:

- `email_providers.syncLeaseExpiresAt` timestamp column
- index on `syncLeaseExpiresAt` for lease-expiry scans/updates

### Safe rollout sequence

1. Deploy backend with scheduler lease acquisition logic.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- gmail-sync/gmail-sync.scheduler.spec.ts outlook-sync/outlook-sync.scheduler.spec.ts email-integration/provider-sync-lease.service.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Validate runtime behavior:
   - duplicate scheduler workers skip provider when active lease exists
   - failed sync clears lease with `status=error`
   - successful sync clears lease with `status=connected`

### Staging verification SQL

```sql
SELECT
  COUNT(*) AS providers_with_active_lease
FROM email_providers
WHERE "syncLeaseExpiresAt" IS NOT NULL
  AND "syncLeaseExpiresAt" > NOW();

SELECT
  status,
  COUNT(*) AS total
FROM email_providers
GROUP BY status
ORDER BY status;
```

## Provider Sync Error State Rollout Notes (2026-02-16)

New migration: `20260216024000-email-provider-sync-error-state.ts`

This migration introduces:

- `email_providers.lastSyncErrorAt` timestamp
- `email_providers.lastSyncError` text payload (trimmed runtime error context)
- index on `lastSyncErrorAt` for support/ops triage queries

### Safe rollout sequence

1. Deploy backend with provider sync error-state writes.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- gmail-sync/gmail-sync.service.spec.ts outlook-sync/outlook-sync.service.spec.ts gmail-sync/gmail-sync.scheduler.spec.ts outlook-sync/outlook-sync.scheduler.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Validate runtime behavior:
   - sync start clears stale error state
   - sync failures persist `lastSyncError` + `lastSyncErrorAt`
   - successful sync clears error state and updates `lastSyncedAt`

### Staging verification SQL

```sql
SELECT
  status,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "lastSyncErrorAt" IS NOT NULL) AS with_error_timestamp
FROM email_providers
GROUP BY status
ORDER BY status;

SELECT
  id,
  type,
  status,
  "lastSyncErrorAt",
  LEFT(COALESCE("lastSyncError", ''), 120) AS error_preview
FROM email_providers
WHERE "lastSyncErrorAt" IS NOT NULL
ORDER BY "lastSyncErrorAt" DESC
LIMIT 25;
```

## AI Credit Usage Rollout Notes (2026-02-16)

New migration: `20260216025000-user-ai-credit-usages.ts`

This migration introduces:

- `user_ai_credit_usages` table for monthly AI credit usage tracking
- unique key on `("userId","periodStart")` for one usage row per user+month
- indexed user + period fields for fast entitlement balance lookups

### Safe rollout sequence

1. Deploy backend with billing credit-balance + consume logic.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- billing/billing.service.spec.ts billing/billing.resolver.spec.ts ai-agent-gateway/ai-agent-gateway.service.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Validate runtime behavior:
   - `myAiCreditBalance` returns active plan credit usage
   - authenticated AI assist calls consume monthly credits
   - exhausted balances reject with explicit credit-limit error

### Staging verification SQL

```sql
SELECT
  "userId",
  "periodStart",
  "usedCredits",
  "lastConsumedAt"
FROM user_ai_credit_usages
ORDER BY "updatedAt" DESC
LIMIT 50;
```

## Billing Invoices/Webhooks + Trial Columns Rollout Notes (2026-02-16)

New migration: `20260216031000-billing-invoices-webhooks-and-trials.ts`

This migration introduces:

- trial state columns on `user_subscriptions`:
  - `isTrial`
  - `trialEndsAt`
- invoice persistence table:
  - `billing_invoices`
- webhook audit/idempotency table:
  - `billing_webhook_events`

### Safe rollout sequence

1. Deploy backend with billing invoice + webhook handlers and trial APIs.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- billing/billing.service.spec.ts billing/billing.resolver.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Validate runtime behavior:
   - `startMyPlanTrial` sets trial fields and emits billing notification.
   - paid plan selection creates invoice rows.
   - `ingestBillingWebhook` is idempotent by `(provider, externalEventId)`.

### Staging verification SQL

```sql
SELECT id, "userId", "planCode", "status", "isTrial", "trialEndsAt"
FROM user_subscriptions
ORDER BY "updatedAt" DESC
LIMIT 50;

SELECT id, "userId", "provider", "status", "amountCents", "createdAt"
FROM billing_invoices
ORDER BY "createdAt" DESC
LIMIT 50;

SELECT id, "provider", "eventType", "externalEventId", "status", "processedAt"
FROM billing_webhook_events
ORDER BY "createdAt" DESC
LIMIT 50;
```

## Outlook Sync Cursor Rollout Notes (2026-02-16)

New migration: `20260216033000-email-provider-outlook-sync-cursor.ts`

This migration introduces:

- `email_providers.outlookSyncCursor` (nullable text)
  - stores Microsoft Graph delta cursor (`@odata.nextLink` / `@odata.deltaLink`)
  - enables incremental Outlook ingestion across scheduler runs

### Safe rollout sequence

1. Deploy backend containing Outlook cursor migration + sync service changes.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- outlook-sync/outlook-sync.service.spec.ts outlook-sync/outlook-sync.scheduler.spec.ts`
   - `npm run build`
5. Verify runtime behavior:
   - first Outlook sync populates `outlookSyncCursor`.
   - later sync runs consume cursor and continue incremental ingestion.
   - if cursor is invalid, service falls back to full sync and re-seeds cursor.

### Staging verification SQL

```sql
SELECT id, email, "status", "lastSyncedAt", "outlookSyncCursor"
FROM email_providers
WHERE type = 'OUTLOOK'
ORDER BY "updatedAt" DESC
LIMIT 50;
```

## Outlook Push Subscription State Rollout Notes (2026-02-16)

New migration: `20260216041000-email-provider-outlook-push-subscription-state.ts`

This migration introduces:

- `email_providers.outlookPushSubscriptionId`
- `email_providers.outlookPushSubscriptionExpiresAt`
- `email_providers.outlookPushSubscriptionLastRenewedAt`

These fields support Outlook webhook subscription renewal and operator visibility.

### Safe rollout sequence

1. Deploy backend containing migration + Outlook push webhook/subscription logic.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Configure push env vars where Outlook push is enabled:
   - `OUTLOOK_PUSH_NOTIFICATION_URL`
   - `OUTLOOK_PUSH_WEBHOOK_TOKEN`
   - `OUTLOOK_PUSH_SUBSCRIPTION_DURATION_MINUTES`
   - `OUTLOOK_PUSH_SUBSCRIPTION_RENEW_THRESHOLD_MINUTES`
5. Run smoke checks:
   - `npm run test -- outlook-sync/outlook-sync.service.spec.ts outlook-sync/outlook-sync-webhook.controller.spec.ts outlook-sync/outlook-sync.scheduler.spec.ts`
   - `npm run build`

### Staging verification SQL

```sql
SELECT
  id,
  email,
  "outlookPushSubscriptionId",
  "outlookPushSubscriptionLastRenewedAt",
  "outlookPushSubscriptionExpiresAt"
FROM email_providers
WHERE type = 'OUTLOOK'
ORDER BY "updatedAt" DESC
LIMIT 50;
```

## Email Mailbox Source Link Rollout Notes (2026-02-16)

New migration: `20260216043000-email-mailbox-source-link.ts`

This migration introduces:

- `emails.mailboxId`
- index `IDX_emails_mailboxId`
- index `IDX_emails_mailboxId_inboundMessageId`
- one-time data backfill that links existing `providerId IS NULL` emails to owned mailbox rows when sender/recipient matches mailbox address

This field links internal email rows to the owning MailZen mailbox, improving
strict mailbox-source isolation in unified inbox queries and mailbox dedup logic.

### Safe rollout sequence

1. Deploy backend containing migration + mailbox inbound/unified inbox updates.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- mailbox/mailbox-inbound.service.spec.ts mailbox/mailbox.service.spec.ts unified-inbox/unified-inbox.service.spec.ts`
   - `npm run build`
5. Verify runtime behavior:
   - new inbound webhook emails are persisted with `mailboxId`.
   - mailbox inbox reads prioritize `mailboxId` scoping and keep fallback behavior for any legacy rows that were not backfilled.

### Staging verification SQL

```sql
SELECT
  id,
  "userId",
  "mailboxId",
  "inboundMessageId",
  "inboundThreadKey",
  "createdAt"
FROM emails
WHERE "inboundMessageId" IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 50;
```

## Mailbox Inbound Sync State Rollout Notes (2026-02-16)

New migration: `20260216045000-mailbox-inbound-sync-state.ts`

This migration introduces:

- `mailboxes.inboundSyncCursor`
- `mailboxes.inboundSyncLastPolledAt`
- `mailboxes.inboundSyncLastError`
- index `IDX_mailboxes_inboundSyncLastPolledAt`

These fields support scheduler-driven mailbox pull ingestion observability and
incremental cursor continuity.

### Safe rollout sequence

1. Deploy backend containing migration + mailbox sync scheduler/service updates.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Configure mailbox sync env vars where pull ingestion is enabled:
   - `MAILZEN_MAILBOX_SYNC_ENABLED`
   - `MAILZEN_MAIL_SYNC_API_URL`
   - `MAILZEN_MAIL_SYNC_API_TOKEN`
   - `MAILZEN_MAIL_SYNC_BATCH_LIMIT`
   - `MAILZEN_MAIL_SYNC_MAX_MAILBOXES_PER_RUN`
5. Run smoke checks:
   - `npm run test -- mailbox/mailbox-sync.service.spec.ts mailbox/mailbox-sync.scheduler.spec.ts mailbox/mailbox-inbound.service.spec.ts`
   - `npm run build`

### Staging verification SQL

```sql
SELECT
  id,
  email,
  "inboundSyncCursor",
  "inboundSyncLastPolledAt",
  "inboundSyncLastError"
FROM mailboxes
ORDER BY "updatedAt" DESC
LIMIT 50;
```

## Mailbox Inbound Sync Lease State Rollout Notes (2026-02-16)

New migration: `20260216052000-mailbox-inbound-sync-lease-state.ts`

This migration introduces:

- `mailboxes.inboundSyncLeaseToken`
- `mailboxes.inboundSyncLeaseExpiresAt`
- index `IDX_mailboxes_inboundSyncLeaseExpiresAt`

These fields provide atomic mailbox-level lease protection to prevent duplicate
poll workers ingesting the same mailbox concurrently.

### Safe rollout sequence

1. Deploy backend containing migration + mailbox sync lease acquisition logic.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Configure lease TTL as needed:
   - `MAILZEN_MAIL_SYNC_LEASE_TTL_SECONDS`
5. Run smoke checks:
   - `npm run test -- mailbox/mailbox-sync.service.spec.ts mailbox/mailbox-sync.scheduler.spec.ts`
   - `npm run build`

### Staging verification SQL

```sql
SELECT
  id,
  email,
  "inboundSyncLeaseToken",
  "inboundSyncLeaseExpiresAt",
  "updatedAt"
FROM mailboxes
ORDER BY "updatedAt" DESC
LIMIT 50;
```

## Mailbox Inbound Sync Lifecycle State Rollout Notes (2026-02-16)

New migration: `20260216061000-mailbox-inbound-sync-lifecycle-state.ts`

This migration introduces:

- `mailboxes.inboundSyncStatus`
- `mailboxes.inboundSyncLastErrorAt`
- index `IDX_mailboxes_inboundSyncStatus`

These fields provide explicit mailbox sync lifecycle state telemetry
(`syncing/connected/error`) with timestamped error observability.

### Safe rollout sequence

1. Deploy backend containing migration + lifecycle state updates in mailbox sync.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- mailbox/mailbox-sync.service.spec.ts mailbox/mailbox-sync.scheduler.spec.ts`
   - `npm run build`

### Staging verification SQL

```sql
SELECT
  id,
  email,
  "inboundSyncStatus",
  "inboundSyncLastPolledAt",
  "inboundSyncLastError",
  "inboundSyncLastErrorAt"
FROM mailboxes
ORDER BY "updatedAt" DESC
LIMIT 50;
```

## Smart Reply History Rollout Notes (2026-02-16)

New migration: `20260216073000-smart-reply-history.ts`

This migration introduces:

- table `smart_reply_history`
- indexes:
  - `IDX_smart_reply_history_user_createdAt`
  - `IDX_smart_reply_history_userId`

The table stores user-scoped smart-reply generation history snapshots
for observability and user-controlled history export/deletion workflows.

### Safe rollout sequence

1. Deploy backend containing migration + smart-reply history persistence.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- smart-replies/smart-reply.service.spec.ts smart-replies/smart-reply.resolver.spec.ts`
   - `npm run build`

### Staging verification SQL

```sql
SELECT
  id,
  "userId",
  source,
  "blockedSensitive",
  "fallbackUsed",
  "createdAt"
FROM smart_reply_history
ORDER BY "createdAt" DESC
LIMIT 50;
```

## Gmail Push Watch State Rollout Notes (2026-02-16)

New migration: `20260216035000-email-provider-gmail-watch-state.ts`

This migration introduces:

- `email_providers.gmailWatchExpirationAt`
- `email_providers.gmailWatchLastRenewedAt`

These fields support proactive Gmail Pub/Sub watch renewal and diagnostics.

### Safe rollout sequence

1. Deploy backend containing migration + Gmail watch renewal logic.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Configure push env vars where Gmail push is enabled:
   - `GMAIL_PUSH_TOPIC_NAME`
   - `GMAIL_PUSH_WATCH_RENEW_THRESHOLD_MINUTES`
   - `GMAIL_PUSH_WATCH_LABEL_IDS`
5. Run smoke checks:
   - `npm run test -- gmail-sync/gmail-sync.service.spec.ts gmail-sync/gmail-sync-webhook.controller.spec.ts`
   - `npm run build`

### Staging verification SQL

```sql
SELECT id, email, "gmailHistoryId", "gmailWatchLastRenewedAt", "gmailWatchExpirationAt"
FROM email_providers
WHERE type = 'GMAIL'
ORDER BY "updatedAt" DESC
LIMIT 50;
```

## Billing Mailbox Storage Entitlement Rollout Notes (2026-02-16)

New migration: `20260216081000-billing-mailbox-storage-limit.ts`

This migration introduces:

- `billing_plans.mailboxStorageLimitMb`
  - per-mailbox storage entitlement ceiling (MB) used by mailbox provisioning
    and inbound quota enforcement
- backfill defaults for first-party catalog codes:
  - `FREE=2048`
  - `PRO=10240`
  - `BUSINESS=51200`

### Safe rollout sequence

1. Deploy backend containing migration + mailbox entitlement enforcement logic.
2. Run `npm run migration:run`.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run test -- billing/billing.service.spec.ts mailbox/mailbox.service.spec.ts mailbox/mailbox-inbound.service.spec.ts`
   - `npm run check:schema:contracts`
   - `npm run build`
5. Validate runtime behavior:
   - newly created mailboxes inherit plan storage quota (`quotaLimitMb`).
   - inbound ingestion rejects writes once mailbox usage exceeds effective
     entitlement quota.

### Staging verification SQL

```sql
SELECT
  code,
  "providerLimit",
  "mailboxLimit",
  "workspaceLimit",
  "mailboxStorageLimitMb"
FROM billing_plans
ORDER BY code;
```
