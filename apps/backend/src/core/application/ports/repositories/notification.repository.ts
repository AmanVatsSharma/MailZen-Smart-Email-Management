/**
 * File:        core/application/ports/repositories/notification.repository.ts
 * Module:      Application - Notifications Bounded Context
 * Purpose:     Port for in-app notification persistence.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Notification } from '../../../domain/bounded-contexts/notifications/notification.aggregate';
import { Result } from '../../../domain/shared/result';

export const NOTIFICATION_REPOSITORY = Symbol('INotificationRepository');

export interface INotificationRepository {
  save(notification: Notification): Promise<Result<void, Error>>;
  findById(id: string): Promise<Notification | null>;
  listForUser(
    userId: string,
    unreadOnly: boolean,
    limit: number,
    offset: number,
  ): Promise<{ items: Notification[]; total: number; unreadCount: number }>;
  markRead(id: string): Promise<Result<void, Error>>;
}
