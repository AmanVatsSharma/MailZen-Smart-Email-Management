/**
 * File:        apps/backend/src/core/application/use-cases/phone/request-verification/request-verification.handler.ts
 * Module:      Phone Use Cases
 * Purpose:     Send an OTP to a phone number: generate code, hash it, persist, send SMS
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import { PHONE_VERIFICATION_REPOSITORY, IPhoneVerificationRepository } from '../../../ports/repositories/phone-verification.repository';
import { SMS_GATEWAY, ISmsGateway } from '../../../ports/gateways/sms.gateway';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { PhoneVerification } from '../../../../domain/bounded-contexts/phone/phone-verification.aggregate';
import { RequestVerificationCommand } from './request-verification.command';

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

@Injectable()
export class RequestVerificationHandler {
  constructor(
    @Inject(PHONE_VERIFICATION_REPOSITORY)
    private phoneVerificationRepo: IPhoneVerificationRepository,
    @Inject(SMS_GATEWAY)
    private smsGateway: ISmsGateway,
  ) {}

  async execute(command: RequestVerificationCommand): Promise<Result<PhoneVerification, ApplicationError>> {
    const code = generateCode();
    const codeHash = hashCode(code);

    const createResult = PhoneVerification.create({
      userId: command.input.userId,
      phoneE164: command.input.phoneE164,
      codeHash,
    });

    if (createResult.isErr()) {
      return Result.err(new ApplicationError('VERIFICATION_CREATE_FAILED', createResult.error.message));
    }

    const verification = createResult.value;
    const saveResult = await this.phoneVerificationRepo.save(verification);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('VERIFICATION_SAVE_FAILED', saveResult.error.message));
    }

    // Send SMS with the raw code
    try {
      await this.smsGateway.send({
        to: command.input.phoneE164,
        body: `Your MailZen verification code is: ${code}. It expires in 10 minutes.`,
      });
    } catch {
      // Best-effort: do not fail the use case if SMS delivery fails
    }

    return Result.ok(verification);
  }
}
