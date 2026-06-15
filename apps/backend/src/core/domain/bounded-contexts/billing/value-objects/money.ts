/**
 * File:        apps/backend/src/core/domain/bounded-contexts/billing/value-objects/money.ts
 * Module:      Billing Domain
 * Purpose:     Money value object with currency-safe arithmetic
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../../../shared/result';

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

export class CurrencyMismatchError extends Error {
  constructor(
    public readonly currency1: string,
    public readonly currency2: string,
  ) {
    super(`Currency mismatch: ${currency1} vs ${currency2}`);
    this.name = 'CurrencyMismatchError';
  }
}

export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {
    if (!Number.isFinite(amount)) {
      throw new InvalidAmountError(`Invalid amount: ${amount}`);
    }
    if (!currency || currency.trim().length === 0) {
      throw new InvalidAmountError('Currency is required');
    }
  }

  static fromCents(cents: number, currency: string = 'USD'): Money {
    return new Money(cents, currency.toUpperCase());
  }

  static zero(currency: string = 'USD'): Money {
    return new Money(0, currency.toUpperCase());
  }

  add(other: Money): Result<Money, CurrencyMismatchError | InvalidAmountError> {
    if (this.currency !== other.currency) {
      return Result.err(new CurrencyMismatchError(this.currency, other.currency));
    }
    return Result.ok(new Money(this.amount + other.amount, this.currency));
  }

  subtract(other: Money): Result<Money, CurrencyMismatchError | InvalidAmountError> {
    if (this.currency !== other.currency) {
      return Result.err(new CurrencyMismatchError(this.currency, other.currency));
    }
    return Result.ok(new Money(this.amount - other.amount, this.currency));
  }

  multiply(factor: number): Result<Money, InvalidAmountError> {
    if (!Number.isFinite(factor)) {
      return Result.err(new InvalidAmountError(`Invalid multiplier: ${factor}`));
    }
    return Result.ok(new Money(this.amount * factor, this.currency));
  }

  divide(divisor: number): Result<Money, InvalidAmountError> {
    if (!Number.isFinite(divisor) || divisor === 0) {
      return Result.err(new InvalidAmountError(`Invalid divisor: ${divisor}`));
    }
    return Result.ok(new Money(this.amount / divisor, this.currency));
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  greaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      return false;
    }
    return this.amount > other.amount;
  }

  lessThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      return false;
    }
    return this.amount < other.amount;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount} ${this.currency}`;
  }
}