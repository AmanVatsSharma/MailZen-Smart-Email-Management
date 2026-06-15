/**
 * File:        apps/backend/src/core/application/use-cases/notifications/dispatch-notification/dispatch-notification.handler.ts
 * Module:      Notifications Use Cases
 * Purpose:     Create and persist a new in-app notification for a user
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../../ports/repositories/notification.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Notification } from '../../../../domain/bounded-contexts/notifications/notification.aggregate';
import { DispatchNotificationCommand } from './dispatch-notification.command';

@Injectable()
export class DispatchNotificationHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private notificationRepo: INotificationRepository,
  ) {}

  async execute(command: DispatchNotificationCommand): Promise<Result<Notification, ApplicationError>> {
    const createResult = Notification.create({
      userId: command.input.userId,
      type: command.input.type,
      title: command.input.title,
      body: command.input.body,
      payload: command.input.payload,
    });

    if (createResult.isErr()) {
      return Result.err(new ApplicationError('NOTIFICATION_CREATE_FAILED', createResult.error.message));
    }

    const notification = createResult.value;
    const saveResult = await this.notificationRepo.save(notification);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('NOTIFICATION_SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(notification);
  }
}
