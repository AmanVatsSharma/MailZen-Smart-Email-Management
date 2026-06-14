/**
 * File:        apps/backend/src/core/application/use-cases/scheduled-email/schedule-email/schedule-email.handler.ts
 * Module:      Scheduled Email Use Cases
 * Purpose:     Schedule an email for future delivery
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULED_EMAIL_REPOSITORY, IScheduledEmailRepository } from '../../ports/repositories/scheduled-email.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { ScheduledEmail } from '../../../../domain/bounded-contexts/scheduled-email/scheduled-email.aggregate';
import { EmailId, UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { ScheduleEmailCommand } from './schedule-email.command';

@Injectable()
export class ScheduleEmailHandler {
  constructor(
    @Inject(SCHEDULED_EMAIL_REPOSITORY)
    private scheduledEmailRepo: IScheduledEmailRepository,
  ) {}

  async execute(command: ScheduleEmailCommand): Promise<Result<ScheduledEmail, ApplicationError>> {
    if (!command.input.emailId || !command.input.workspaceId || !command.input.senderId) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'emailId, workspaceId, and senderId are required'));
    }
    if (!command.input.scheduledFor) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'scheduledFor is required'));
    }

    const createResult = ScheduledEmail.create({
      emailId: EmailId.from(command.input.emailId),
      workspaceId: WorkspaceId.from(command.input.workspaceId),
      senderId: UserId.from(command.input.senderId),
      scheduledFor: command.input.scheduledFor,
    });

    if (createResult.isErr()) {
      return Result.err(new ApplicationError('SCHEDULE_CREATE_FAILED', createResult.error.message));
    }

    const scheduled = createResult.value;
    const saveResult = await this.scheduledEmailRepo.save(scheduled);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SCHEDULE_SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(scheduled);
  }
}
