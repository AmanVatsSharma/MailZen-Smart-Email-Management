/**
 * File:        apps/backend/src/core/application/use-cases/messaging/record-warmup-activity/record-warmup-activity.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     RecordWarmupActivity use case. Records an activity tick for
 *              a warm-up and lets the aggregate adjust its daily limit.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailWarmupRepository,
  EMAIL_WARMUP_REPOSITORY,
} from '../../../ports/repositories/email-warmup.repository';
import { Result, makeResult } from '../../../../domain/shared/result';
import { NotFoundError, ValidationError } from '../../../exceptions/application-error';
import { RecordWarmupActivityInput, RecordWarmupActivityOutput } from './record-warmup-activity.dto';

export const RECORD_WARMUP_ACTIVITY_HANDLER = Symbol('RecordWarmupActivityHandler');

export class RecordWarmupActivityHandler {
  constructor(private readonly warmups: IEmailWarmupRepository) {}

  async execute(input: RecordWarmupActivityInput): Promise<Result<RecordWarmupActivityOutput, Error>> {
    if (input.openRate < 0 || input.openRate > 100) {
      return makeResult(Result.err(new ValidationError('openRate must be 0..100', 'openRate')));
    }
    const w = await this.warmups.findById(input.warmupId);
    if (!w) return makeResult(Result.err(new NotFoundError('Warmup')));
    w.recordActivity(input.emailsSent, input.openRate);
    await this.warmups.save(w);
    return makeResult(Result.ok({ currentDailyLimit: w.currentDailyLimit }));
  }
}
