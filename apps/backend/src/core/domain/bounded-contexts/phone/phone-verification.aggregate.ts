/**
 * File:        core/domain/bounded-contexts/phone/phone-verification.aggregate.ts
 * Module:      Domain - Phone Verification Bounded Context
 * Purpose:     OTP-based phone verification. Codes are hashed at rest and expire.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result } from '../../shared/result';

export interface PhoneVerificationProps {
  id: string;
  userId: string | null;
  phoneE164: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export class PhoneVerification extends AggregateRoot<PhoneVerificationProps> {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  get id(): string { return this.props.id; }
  get phoneE164(): string { return this.props.phoneE164; }
  get isVerified(): boolean { return this.props.verifiedAt !== null; }
  get isExpired(): boolean { return this.props.expiresAt.getTime() < Date.now(); }

  private constructor(props: PhoneVerificationProps) {
    super(props);
  }

  static create(input: {
    userId: string | null;
    phoneE164: string;
    codeHash: string;
  }): Result<PhoneVerification, Error> {
    if (!/^\+\d{8,15}$/.test(input.phoneE164)) {
      return Result.err(new Error('phoneE164 must be in E.164 format'));
    }
    return Result.ok(new PhoneVerification({
      id: crypto.randomUUID(),
      userId: input.userId,
      phoneE164: input.phoneE164,
      codeHash: input.codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + PhoneVerification.TTL_MS),
      verifiedAt: null,
      createdAt: new Date(),
    }));
  }

  static reconstitute(props: PhoneVerificationProps): PhoneVerification {
    return new PhoneVerification(props);
  }

  verify(code: string, codeHash: (s: string) => string): Result<PhoneVerification, Error> {
    if (this.isVerified) return Result.err(new Error('Already verified'));
    if (this.isExpired) return Result.err(new Error('Code expired'));
    if (this.props.attempts >= PhoneVerification.MAX_ATTEMPTS) {
      return Result.err(new Error('Too many attempts'));
    }
    if (codeHash(code) !== this.props.codeHash) {
      return Result.ok(new PhoneVerification({
        ...this.props,
        attempts: this.props.attempts + 1,
      }));
    }
    return Result.ok(new PhoneVerification({
      ...this.props,
      attempts: this.props.attempts + 1,
      verifiedAt: new Date(),
    }));
  }
}
