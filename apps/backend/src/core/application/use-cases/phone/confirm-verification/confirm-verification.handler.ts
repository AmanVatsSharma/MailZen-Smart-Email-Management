/**
 * File:        apps/backend/src/core/application/use-cases/phone/confirm-verification/confirm-verification.handler.ts
 * Module:      Phone Use Cases
 * Purpose:     Verify an OTP code for a phone number
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import { PHONE_VERIFICATION_REPOSITORY, IPhoneVerificationRepository } from '../../ports/repositories/phone-verification.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { PhoneVerification } from '../../../../domain/bounded-contexts/phone/phone-verification.aggregate';
import { ConfirmVerificationCommand } from './confirm-verification.command';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

@Injectable()
export class ConfirmVerificationHandler {
  constructor(
    @Inject(PHONE_VERIFICATION_REPOSITORY)
    private phoneVerificationRepo: IPhoneVerificationRepository,
  ) {}

  async execute(command: ConfirmVerificationCommand): Promise<Result<PhoneVerification, ApplicationError>> {
    if (!command.input.code) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'code is required'));
    }

    const existing = await this.phoneVerificationRepo.findActiveForPhone(command.input.phoneE164);
    if (!existing) {
      return Result.err(new ApplicationError('NOT_FOUND', 'No active verification found for this phone number'));
    }

    const verifyResult = existing.verify(command.input.code, hashCode);
    if (verifyResult.isErr()) {
      return Result.err(new ApplicationError('VERIFICATION_FAILED', verifyResult.error.message));
    }

    const updated = verifyResult.value;
    // Persist the updated state (attempt count or verifiedAt) — verify() returns
    // a new immutable instance, so the original is unchanged.
    const saveResult = await this.phoneVerificationRepo.save(updated);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(updated);
  }
}
