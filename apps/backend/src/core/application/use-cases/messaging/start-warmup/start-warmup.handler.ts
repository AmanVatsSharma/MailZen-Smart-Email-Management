/**
 * File:        apps/backend/src/core/application/use-cases/messaging/start-warmup/start-warmup.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     StartWarmup use case. Starts a new warm-up campaign for a
 *              provider, or resumes a paused one.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { randomUUID } from 'crypto';
import {
  IEmailWarmupRepository,
  EMAIL_WARMUP_REPOSITORY,
} from '../../../ports/repositories/email-warmup.repository';
import { EmailWarmup } from '../../../../../domain/bounded-contexts/messaging/warmup.aggregate';
import { Result, makeResult } from '../../../../../domain/shared/result';
import { ConflictError, ValidationError } from '../../../exceptions/application-error';
import { StartWarmupInput, StartWarmupOutput } from './start-warmup.dto';

export const START_WARMUP_HANDLER = Symbol('StartWarmupHandler');

export class StartWarmupHandler {
  constructor(private readonly warmups: IEmailWarmupRepository) {}

  async execute(input: StartWarmupInput): Promise<Result<StartWarmupOutput, Error>> {
    if (!input.providerId || input.providerId.trim().length === 0) {
      return makeResult(Result.err(new ValidationError('providerId is required', 'providerId')));
    }
    const existing = await this.warmups.findByProviderId(input.providerId);
    if (existing) {
      if (existing.status === 'PAUSED') {
        existing.resume();
        await this.warmups.save(existing);
        return makeResult(Result.ok({ id: existing.id, status: existing.status, currentDailyLimit: existing.currentDailyLimit }));
      }
      return makeResult(Result.err(new ConflictError('warm-up already exists for this provider')));
    }
    const created = EmailWarmup.start({ id: randomUUID(), providerId: input.providerId, config: input.config });
    if (!created.ok) return makeResult(Result.err(new ValidationError(created.error.message)));
    await this.warmups.save(created.value);
    return makeResult(Result.ok({ id: created.value.id, status: created.value.status, currentDailyLimit: created.value.currentDailyLimit }));
  }
}
