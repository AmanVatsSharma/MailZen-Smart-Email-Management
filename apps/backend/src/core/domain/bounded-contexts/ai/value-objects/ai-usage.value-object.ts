/**
 * File:        apps/backend/src/core/domain/bounded-contexts/ai/value-objects/ai-usage.value-object.ts
 * Module:      AI · Value Object
 * Purpose:     AiUsage VO. Models credits/costs for AI operations.
 *              Provides read operations for billing integration.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result, makeResult } from '../../../shared/result';

export interface AiUsageProps {
  consumedCredits: number;
  monthlyLimit: number;
  refillCredits: number;
}

export class AiUsage {
  private constructor(private props: AiUsageProps) {
    if (props.consumedCredits < 0 || props.refillCredits < 0 || props.monthlyLimit < 0) {
      throw new Error('Negative values not allowed');
    }
  }

  static create(consumedCredits: number, monthlyLimit: number, refillCredits: number): Result<AiUsage, InvalidUsageError> {
    const errors: string[] = [];

    if (consumedCredits < 0) errors.push('Consumed credits cannot be negative');
    if (refillCredits < 0) errors.push('Refill credits cannot be negative');
    if (monthlyLimit < 0) errors.push('Monthly limit cannot be negative');

    if (errors.length > 0) {
      return makeResult(Result.err(new InvalidUsageError(errors.join(', '))));
    }

    return makeResult(Result.ok(new AiUsage({
      consumedCredits,
      monthlyLimit,
      refillCredits,
    })));
  }

  static unsafeCreate(consumedCredits: number, monthlyLimit: number, refillCredits: number): AiUsage {
    return AiUsage.create(consumedCredits, monthlyLimit, refillCredits).unwrap();
  }

  get consumedCredits(): number { return this.props.consumedCredits; }
  get monthlyLimit(): number { return this.props.monthlyLimit; }
  get refillCredits(): number { return this.props.refillCredits; }
  get remaining(): number {
    const baseRemaining = this.props.monthlyLimit - this.props.consumedCredits;
    return Math.max(0, baseRemaining) + this.props.refillCredits;
  }

  consume(credits: number): Result<AiUsage, CreditsExhaustedError> {
    if (credits < 0) {
      return makeResult(Result.err(new CreditsExhaustedError('Cannot consume negative credits')));
    }

    const newConsumed = this.props.consumedCredits + credits;
    if (newConsumed > this.props.monthlyLimit) {
      return makeResult(Result.err(new CreditsExhaustedError(
        `Insufficient credits: required ${newConsumed}, limit ${this.props.monthlyLimit}`
      )));
    }

    return makeResult(Result.ok(new AiUsage({
      consumedCredits: newConsumed,
      monthlyLimit: this.props.monthlyLimit,
      refillCredits: this.props.refillCredits,
    })));
  }

  refill(credits: number): Result<AiUsage, InvalidCreditsError> {
    if (credits < 0) {
      return makeResult(Result.err(new InvalidCreditsError('Refill credits cannot be negative')));
    }

    const newRefill = this.props.refillCredits + credits;
    return makeResult(Result.ok(new AiUsage({
      consumedCredits: this.props.consumedCredits,
      monthlyLimit: this.props.monthlyLimit,
      refillCredits: newRefill,
    })));
  }

  equals(other: AiUsage): boolean {
    return this.props.consumedCredits === other.props.consumedCredits &&
           this.props.monthlyLimit === other.props.monthlyLimit &&
           this.props.refillCredits === other.props.refillCredits;
  }

  reset(): AiUsage {
    return AiUsage.unsafeCreate(0, this.props.monthlyLimit, this.props.refillCredits);
  }
}

export class InvalidUsageError extends Error {
  readonly kind = 'InvalidUsageError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUsageError';
  }
}

export class CreditsExhaustedError extends Error {
  readonly kind = 'CreditsExhaustedError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'CreditsExhaustedError';
  }
}

export class InvalidCreditsError extends Error {
  readonly kind = 'InvalidCreditsError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCreditsError';
  }
}