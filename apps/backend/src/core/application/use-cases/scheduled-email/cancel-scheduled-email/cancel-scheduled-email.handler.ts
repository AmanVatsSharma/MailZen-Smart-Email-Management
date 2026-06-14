/**
 * File:        apps/backend/src/core/application/use-cases/scheduled-email/cancel-scheduled-email/cancel-scheduled-email.handler.ts
 * Module:      Scheduled Email Use Cases
 * Purpose:     Cancel a scheduled email after verifying workspace ownership
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULED_EMAIL_REPOSITORY, IScheduledEmailRepository } from '../../ports/repositories/scheduled-email.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { CancelScheduledEmailCommand } from './cancel-scheduled-email.command';

@Injectable()
export class CancelScheduledEmailHandler {
  constructor(
    @Inject(SCHEDULED_EMAIL_REPOSITORY)
    private scheduledEmailRepo: IScheduledEmailRepository,
  ) {}

  async execute(command: CancelScheduledEmailCommand): Promise<Result<void, ApplicationError>> {
    const scheduled = await this.scheduledEmailRepo.findById(command.input.id);
    if (!scheduled) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Scheduled email not found'));
    }

    if (scheduled.workspaceId !== command.input.workspaceId) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Cannot cancel a scheduled email in another workspace'));
    }

    const cancelResult = scheduled.cancel();
    if (cancelResult.isErr()) {
      return Result.err(new ApplicationError('CANCEL_FAILED', cancelResult.error.message));
    }

    const saveResult = await this.scheduledEmailRepo.save(cancelResult.value);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(undefined);
  }
}
