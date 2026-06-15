// apps/backend/src/core/domain/shared/value-objects/email-address.ts
// Pure value object. No framework imports. Zero side effects.

import { Result, makeResult } from '../result';

export class EmailAddress {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<EmailAddress, InvalidEmailError> {
    const normalized = raw.trim().toLowerCase();
    if (!EmailAddress.REGEX.test(normalized)) {
      return makeResult(Result.err(new InvalidEmailError(raw)));
    }
    return makeResult(Result.ok(new EmailAddress(normalized)));
  }

  static unsafe(raw: string): EmailAddress {
    return EmailAddress.create(raw).unwrap();
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  get domain(): string {
    return this.value.split('@')[1];
  }

  get local(): string {
    return this.value.split('@')[0];
  }

  private static readonly REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
}

export class InvalidEmailError extends Error {
  readonly kind = 'InvalidEmailError' as const;
  constructor(public readonly input: string) {
    super(`Invalid email: ${input}`);
    this.name = 'InvalidEmailError';
  }
}
