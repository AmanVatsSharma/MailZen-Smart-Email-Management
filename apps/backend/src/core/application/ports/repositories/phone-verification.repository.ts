/**
 * File:        core/application/ports/repositories/phone-verification.repository.ts
 * Module:      Application - Phone Bounded Context
 * Purpose:     Port for OTP verification persistence.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { PhoneVerification } from '../../../domain/bounded-contexts/phone/phone-verification.aggregate';
import { Result } from '../../../domain/shared/result';

export const PHONE_VERIFICATION_REPOSITORY = Symbol('IPhoneVerificationRepository');

export interface IPhoneVerificationRepository {
  save(verification: PhoneVerification): Promise<Result<void, Error>>;
  findActiveForPhone(phoneE164: string): Promise<PhoneVerification | null>;
}
