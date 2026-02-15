# Notification Module (Backend)

## Goal

Provide a persistent notification foundation for user-visible product events
(starting with provider sync failures).

## Responsibilities

- Persist user notifications in Postgres (`user_notifications`)
- Query notifications for current user
- Track unread notification count
- Mark notifications as read
- Provide reusable `createNotification` API for other backend modules

## GraphQL API

- `myNotifications(limit, unreadOnly)` → list recent notifications
- `myUnreadNotificationCount` → unread badge count
- `markNotificationRead(id)` → marks one notification as read

## Initial event producers

- `GmailSyncScheduler` emits `SYNC_FAILED` notification on cron sync failure
- `OutlookSyncScheduler` emits `SYNC_FAILED` notification on cron sync failure

## Flow

```mermaid
flowchart TD
  Scheduler[Provider Sync Scheduler] --> NotificationService
  NotificationService --> Repo[(user_notifications table)]
  UserUI[Authenticated frontend] --> NotificationResolver
  NotificationResolver --> NotificationService
  NotificationService --> UserUI
```

