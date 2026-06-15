/**
 * File:        apps/backend/src/core/application/use-cases/email-analytics/get-email-stats/get-email-stats.handler.ts
 * Module:      Email Analytics Use Cases
 * Purpose:     Retrieve aggregate open/click counts for an email
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { TRACKING_EVENT_REPOSITORY, ITrackingEventRepository } from '../../../ports/repositories/tracking-event.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { GetEmailStatsCommand } from './get-email-stats.command';

export interface EmailStatsResult {
  opens: number;
  clicks: number;
}

@Injectable()
export class GetEmailStatsHandler {
  constructor(
    @Inject(TRACKING_EVENT_REPOSITORY)
    private trackingEventRepo: ITrackingEventRepository,
  ) {}

  async execute(command: GetEmailStatsCommand): Promise<Result<EmailStatsResult, ApplicationError>> {
    if (!command.input.emailId) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'emailId is required'));
    }

    const [opens, clicks] = await Promise.all([
      this.trackingEventRepo.countOpens(command.input.emailId),
      this.trackingEventRepo.countClicks(command.input.emailId),
    ]);

    return Result.ok({ opens, clicks });
  }
}
