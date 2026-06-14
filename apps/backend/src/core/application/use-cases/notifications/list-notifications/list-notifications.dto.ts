/**
 * File:        apps/backend/src/core/application/use-cases/notifications/list-notifications/list-notifications.dto.ts
 * Module:      Notifications Use Cases
 * Purpose:     Data transfer object for ListNotifications use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ListNotificationsDto {
  userId: string;
  limit: number;
  offset: number;
  unreadOnly?: boolean;
}
