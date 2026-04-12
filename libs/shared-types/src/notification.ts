/**
 * Notification domain types shared across frontend and backend.
 */

export type NotificationType =
  | 'EMAIL_RECEIVED'
  | 'EMAIL_OPENED'
  | 'EMAIL_CLICKED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'BILLING_UPDATED'
  | 'WORKSPACE_INVITE'
  | 'SECURITY_ALERT'
  | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  workspaceId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type NotificationRealtimeEventType =
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATIONS_MARKED_READ';

export interface NotificationRealtimeEvent {
  eventType: NotificationRealtimeEventType;
  userId: string;
  workspaceId?: string | null;
  notificationId?: string;
  notificationType?: NotificationType;
  notificationTitle?: string;
  notificationMessage?: string;
  markedCount?: number;
  createdAtIso: string;
}
