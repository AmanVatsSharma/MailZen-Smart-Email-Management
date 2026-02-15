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
