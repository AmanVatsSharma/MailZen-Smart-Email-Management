/**
 * File:        apps/backend/src/core/application/use-cases/notifications/list-notifications/list-notifications.handler.ts
 * Module:      Notifications Use Cases
 * Purpose:     List in-app notifications for a user (paginated, with unread count)
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../ports/repositories/notification.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { Notification } from '../../../../domain/bounded-contexts/notifications/notification.aggregate';
import { ListNotificationsCommand } from './list-notifications.command';

export interface ListNotificationsResult {
  items: Notification[];
  total: number;
  unreadCount: number;
}

@Injectable()
export class ListNotificationsHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private notificationRepo: INotificationRepository,
  ) {}

  async execute(command: ListNotificationsCommand): Promise<Result<ListNotificationsResult, ApplicationError>> {
    if (!command.input.userId) {
      return Result.err(new ApplicationError('INVALID_USER', 'userId is required'));
    }

    const limit = Math.max(1, Math.min(command.input.limit ?? 50, 200));
    const offset = Math.max(0, command.input.offset ?? 0);
    const unreadOnly = command.input.unreadOnly ?? false;

    const page = await this.notificationRepo.listForUser(
      command.input.userId,
      unreadOnly,
      limit,
      offset,
    );

    return Result.ok(page);
  }
}
