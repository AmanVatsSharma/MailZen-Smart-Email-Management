/**
 * File:        apps/backend/src/core/domain/bounded-contexts/billing/ai-credits.value-object.ts
 * Module:      Billing Domain
 * Purpose:     AI credits value object with consumption logic
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../../shared/result';

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(`Insufficient AI credits: requested ${requested}, available ${available}`);
    this.name = 'InsufficientCreditsError';
  }
}

export class InvalidCreditAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCreditAmountError';
  }
}

export class AiCredits {
  private constructor(
    public readonly used: number,
    public readonly limit: number,
    public readonly lastConsumedAt?: Date,
  ) {
    if (used < 0) {
      throw new InvalidCreditAmountError('Used credits cannot be negative');
    }
    if (limit < 0) {
      throw new InvalidCreditAmountError('Credit limit cannot be negative');
    }
  }

  static create(used: number, limit: number, lastConsumedAt?: Date): AiCredits {
    return new AiCredits(used, limit, lastConsumedAt);
  }

  static empty(): AiCredits {
    return new AiCredits(0, 0);
  }

  static fromLimit(limit: number): AiCredits {
    return new AiCredits(0, limit);
  }

  get remaining(): number {
    return Math.max(this.limit - this.used, 0);
  }

  get usagePercent(): number {
    if (this.limit === 0) return 0;
    return Math.min(100, (this.used / this.limit) * 100);
  }

  hasCredits(amount: number = 1): boolean {
    if (amount <= 0) return true;
    return this.remaining >= amount;
  }

  consume(amount: number): Result<AiCredits, InsufficientCreditsError> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return Result.err(new InsufficientCreditsError(amount, this.remaining));
    }

    if (!this.hasCredits(amount)) {
      return Result.err(new InsufficientCreditsError(amount, this.remaining));
    }

    return Result.ok(new AiCredits(this.used + amount, this.limit, new Date()));
  }

  add(amount: number): Result<AiCredits, InvalidCreditAmountError> {
    if (!Number.isFinite(amount) || amount < 0) {
      return Result.err(new InvalidCreditAmountError(`Cannot add negative amount: ${amount}`));
    }

    return Result.ok(new AiCredits(this.used, this.limit + amount, this.lastConsumedAt));
  }

  reset(): AiCredits {
    return new AiCredits(0, this.limit);
  }

  withLimit(newLimit: number): Result<AiCredits, InvalidCreditAmountError> {
    if (newLimit < 0) {
      return Result.err(new InvalidCreditAmountError('Credit limit cannot be negative'));
    }
    return Result.ok(new AiCredits(this.used, newLimit, this.lastConsumedAt));
  }

  equals(other: AiCredits): boolean {
    return this.used === other.used && this.limit === other.limit;
  }
}