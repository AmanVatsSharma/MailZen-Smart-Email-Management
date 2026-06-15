/**
 * File:        core/domain/bounded-contexts/identity/value-objects/password-hash.ts
 * Module:      Domain - Identity Bounded Context
 * Purpose:     Opaque password hash value object for secure password storage
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result, makeResult } from '../../../shared/result';

export class PasswordHash {
  private constructor(private readonly value: string) {}

  static create(rawHash: string): Result<PasswordHash, InvalidPasswordHashError> {
    if (!rawHash || typeof rawHash !== 'string' || rawHash.length < 60) {
      return makeResult(Result.err(new InvalidPasswordHashError('Invalid password hash')));
    }
    return makeResult(Result.ok(new PasswordHash(rawHash)));
  }

  static unsafe(rawHash: string): PasswordHash {
    return PasswordHash.create(rawHash).unwrap();
  }

  verify(plain: string): Promise<boolean> {
    // This would be implemented in the adapter
    return Promise.resolve(false);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PasswordHash): boolean {
    return this.value === other.value;
  }
}

export class InvalidPasswordHashError extends Error {
  readonly kind = 'InvalidPasswordHashError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPasswordHashError';
  }
}