/**
 * File:        apps/backend/src/core/application/use-cases/notifications/mark-read/mark-read.handler.ts
 * Module:      Notifications Use Cases
 * Purpose:     Mark a notification as read after verifying the user owns it
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../../ports/repositories/notification.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { MarkNotificationReadCommand } from './mark-read.command';

@Injectable()
export class MarkNotificationReadHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private notificationRepo: INotificationRepository,
  ) {}

  async execute(command: MarkNotificationReadCommand): Promise<Result<void, ApplicationError>> {
    const notification = await this.notificationRepo.findById(command.input.id);
    if (!notification) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Notification not found'));
    }

    if (notification.userId !== command.input.userId) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Cannot mark another user\'s notification'));
    }

    if (!notification.isUnread) {
      return Result.ok(undefined);
    }

    const updated = notification.markRead();
    const saveResult = await this.notificationRepo.save(updated);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(undefined);
  }
}
