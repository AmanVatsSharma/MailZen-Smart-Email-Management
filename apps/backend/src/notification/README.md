# Notification Module (Backend)

## Goal

Provide a persistent notification foundation for user-visible product events
(starting with provider sync failures).

## Responsibilities

- Persist user notifications in Postgres (`user_notifications`)
- Persist user notification preferences (`user_notification_preferences`)
- Query notifications for current user
- Track unread notification count
- Mark notifications as read
- Provide reusable `createNotification` API for other backend modules

## GraphQL API

- `myNotifications(limit, unreadOnly)` → list recent notifications
- `myUnreadNotificationCount` → unread badge count
- `myNotificationPreferences` → get per-user notification channel settings
- `markNotificationRead(id)` → marks one notification as read
- `updateMyNotificationPreferences(input)` → update channel + event preferences

## Initial event producers

- `GmailSyncScheduler` emits `SYNC_FAILED` notification on cron sync failure
- `OutlookSyncScheduler` emits `SYNC_FAILED` notification on cron sync failure
- Emission respects stored user preferences (`inAppEnabled`, `syncFailureEnabled`)

## Flow

```mermaid
flowchart TD
  Scheduler[Provider Sync Scheduler] --> NotificationService
  NotificationService --> Repo[(user_notifications table)]
  UserUI[Authenticated frontend] --> NotificationResolver
  NotificationResolver --> NotificationService
  NotificationService --> UserUI
```

