/**
 * File:        apps/backend/src/core/domain/bounded-contexts/billing/plan.aggregate.ts
 * Module:      Billing Domain
 * Purpose:     Plan aggregate root
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';
import { Result, makeResult } from '../../shared/result';
import { Money } from './value-objects/money';

export interface PlanProps {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  currency: string;
  features: string[];
  monthlyAiCredits: number;
  seats: number;
  providerLimit: number;
  mailboxLimit: number;
  workspaceLimit: number;
  workspaceMemberLimit: number;
  mailboxStorageLimitMb: number;
  automationsEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Plan extends AggregateRoot<PlanProps> {
  static reconstitute(props: PlanProps): Plan {
    return new Plan(props);
  }

  static create(props: Omit<PlanProps, 'id' | 'createdAt' | 'updatedAt'>): Result<Plan> {
    if (!props.code || props.code.trim().length === 0) {
      return Result.err(new Error('Plan code is required'));
    }

    if (!props.name || props.name.trim().length === 0) {
      return Result.err(new Error('Plan name is required'));
    }

    if (props.priceCents < 0) {
      return Result.err(new Error('Plan price cannot be negative'));
    }

    return Result.ok(
      new Plan({
        ...props,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  get price(): Money {
    return new Money(this.props.priceCents, this.props.currency);
  }

  hasFeature(feature: string): boolean {
    return this.props.features.includes(feature);
  }

  isFree(): boolean {
    return this.props.priceCents === 0;
  }

  hasAutomations(): boolean {
    return this.props.automationsEnabled;
  }

  activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  updatePrice(priceCents: number, currency: string): Result<void> {
    if (priceCents < 0) {
      return Result.err(new Error('Plan price cannot be negative'));
    }

    if (!currency || currency.trim().length === 0) {
      return Result.err(new Error('Currency is required'));
    }

    this.props.priceCents = priceCents;
    this.props.currency = currency.toUpperCase();
    this.props.updatedAt = new Date();

    return Result.ok(undefined);
  }

  updateFeatures(features: string[]): void {
    this.props.features = [...features];
    this.props.updatedAt = new Date();
  }

  updateLimits(limits: Partial<{
    monthlyAiCredits: number;
    seats: number;
    providerLimit: number;
    mailboxLimit: number;
    workspaceLimit: number;
    workspaceMemberLimit: number;
    mailboxStorageLimitMb: number;
  }>): Result<void> {
    if (limits.monthlyAiCredits !== undefined && limits.monthlyAiCredits < 0) {
      return Result.err(new Error('Monthly AI credits cannot be negative'));
    }
    if (limits.seats !== undefined && limits.seats < 1) {
      return Result.err(new Error('Seats must be at least 1'));
    }

    Object.assign(this.props, limits);
    this.props.updatedAt = new Date();
    return Result.ok(undefined);
  }
}

export class PlanCreatedEvent implements DomainEvent {
  static readonly TYPE = 'billing.plan.created';
  readonly type = PlanCreatedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly planId: string;
  readonly planCode: string;

  constructor(planId: string, planCode: string) {
    this.planId = planId;
    this.planCode = planCode;
    this.timestamp = new Date();
  }
}

export class PlanUpdatedEvent implements DomainEvent {
  static readonly TYPE = 'billing.plan.updated';
  readonly type = PlanUpdatedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly planId: string;
  readonly planCode: string;

  constructor(planId: string, planCode: string) {
    this.planId = planId;
    this.planCode = planCode;
    this.timestamp = new Date();
  }
}