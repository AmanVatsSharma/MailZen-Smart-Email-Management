/**
 * File:        apps/backend/src/core/application/use-cases/notifications/dispatch-notification/dispatch-notification.dto.ts
 * Module:      Notifications Use Cases
 * Purpose:     Data transfer object for DispatchNotification use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { NotificationType } from '../../../../domain/bounded-contexts/notifications/notification.aggregate';

export interface DispatchNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}
