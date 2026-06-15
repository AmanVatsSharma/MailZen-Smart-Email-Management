/**
 * File:        apps/backend/src/core/application/use-cases/messaging/end-warmup/end-warmup.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     EndWarmup use case. Marks the warm-up as COMPLETED.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailWarmupRepository,
  EMAIL_WARMUP_REPOSITORY,
} from '../../../ports/repositories/email-warmup.repository';
import { Result, makeResult } from '../../../../domain/shared/result';
import { NotFoundError } from '../../../exceptions/application-error';
import { EndWarmupInput, EndWarmupOutput } from './end-warmup.dto';

export const END_WARMUP_HANDLER = Symbol('EndWarmupHandler');

export class EndWarmupHandler {
  constructor(private readonly warmups: IEmailWarmupRepository) {}

  async execute(input: EndWarmupInput): Promise<Result<EndWarmupOutput, Error>> {
    const w = await this.warmups.findById(input.warmupId);
    if (!w) return makeResult(Result.err(new NotFoundError('Warmup')));
    w.end();
    await this.warmups.save(w);
    return makeResult(Result.ok({ id: w.id, status: w.status }));
  }
}
