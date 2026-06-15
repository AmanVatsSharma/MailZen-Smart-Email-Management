/**
 * File:        apps/backend/src/core/domain/bounded-contexts/billing/subscription.aggregate.ts
 * Module:      Billing Domain
 * Purpose:     Subscription aggregate root with lifecycle methods
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { DomainEvent } from '../../shared/domain-event';
import { Result, makeResult } from '../../shared/result';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';

export interface SubscriptionProps {
  id: string;
  workspaceId: string;
  planId: string;
  planCode: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date | null;
  trialEndsAt?: Date | null;
  startedAt: Date;
  endsAt?: Date | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Subscription extends AggregateRoot<SubscriptionProps> {
  static create(props: Omit<SubscriptionProps, 'id' | 'createdAt' | 'updatedAt'>): Result<Subscription> {
    if (props.currentPeriodEnd <= props.currentPeriodStart) {
      return Result.err(new Error('Period end must be after period start'));
    }

    return Result.ok(
      new Subscription({
        ...props,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  changePlan(planId: string, planCode: string): Result<void> {
    if (this.props.status === 'canceled') {
      return Result.err(new Error('Cannot change plan on a canceled subscription'));
    }

    if (this.props.planId === planId) {
      return Result.ok(undefined);
    }

    const previousPlanCode = this.props.planCode;
    this.props.planId = planId;
    this.props.planCode = planCode;
    this.props.status = 'active';
    this.props.cancelAtPeriodEnd = false;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new PlanChangedEvent(
      this.props.id,
      this.props.workspaceId,
      previousPlanCode,
      planCode,
    ));

    return Result.ok(undefined);
  }

  cancel(): Result<void> {
    if (this.props.status === 'canceled') {
      return Result.err(new Error('Subscription is already canceled'));
    }

    this.props.status = 'canceled';
    this.props.canceledAt = new Date();
    this.props.cancelAtPeriodEnd = false;
    this.props.endsAt = this.props.currentPeriodEnd;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new SubscriptionCanceledEvent(
      this.props.id,
      this.props.workspaceId,
      this.props.planCode,
    ));

    return Result.ok(undefined);
  }

  scheduleCancellation(): Result<void> {
    if (this.props.status === 'canceled') {
      return Result.err(new Error('Subscription is already canceled'));
    }

    this.props.cancelAtPeriodEnd = true;
    this.props.updatedAt = new Date();

    return Result.ok(undefined);
  }

  cancelScheduledCancellation(): Result<void> {
    if (!this.props.cancelAtPeriodEnd) {
      return Result.ok(undefined);
    }

    this.props.cancelAtPeriodEnd = false;
    this.props.updatedAt = new Date();

    return Result.ok(undefined);
  }

  renew(periodStart: Date, periodEnd: Date): Result<void> {
    if (this.props.status === 'canceled') {
      return Result.err(new Error('Cannot renew a canceled subscription'));
    }

    if (periodEnd <= periodStart) {
      return Result.err(new Error('Period end must be after period start'));
    }

    this.props.status = 'active';
    this.props.currentPeriodStart = periodStart;
    this.props.currentPeriodEnd = periodEnd;
    this.props.cancelAtPeriodEnd = false;
    this.props.endsAt = null;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new SubscriptionRenewedEvent(
      this.props.id,
      this.props.workspaceId,
      this.props.planCode,
      periodStart,
      periodEnd,
    ));

    return Result.ok(undefined);
  }

  markAsPastDue(): void {
    if (this.props.status === 'canceled') {
      return;
    }

    this.props.status = 'past_due';
    this.props.updatedAt = new Date();
  }

  startTrial(trialEndsAt: Date): Result<void> {
    if (this.props.status === 'canceled') {
      return Result.err(new Error('Cannot start trial on a canceled subscription'));
    }

    if (trialEndsAt <= new Date()) {
      return Result.err(new Error('Trial end must be in the future'));
    }

    this.props.status = 'trialing';
    this.props.trialEndsAt = trialEndsAt;
    this.props.updatedAt = new Date();

    return Result.ok(undefined);
  }

  isActive(): boolean {
    return this.props.status === 'active' || this.props.status === 'trialing';
  }

  isCanceling(): boolean {
    return this.props.cancelAtPeriodEnd;
  }
}

export class PlanChangedEvent implements DomainEvent {
  static readonly TYPE = 'billing.subscription.plan-changed';
  readonly type = PlanChangedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly subscriptionId: string;
  readonly workspaceId: string;
  readonly previousPlanCode: string;
  readonly newPlanCode: string;

  constructor(
    subscriptionId: string,
    workspaceId: string,
    previousPlanCode: string,
    newPlanCode: string,
  ) {
    this.subscriptionId = subscriptionId;
    this.workspaceId = workspaceId;
    this.previousPlanCode = previousPlanCode;
    this.newPlanCode = newPlanCode;
    this.timestamp = new Date();
  }
}

export class SubscriptionCanceledEvent implements DomainEvent {
  static readonly TYPE = 'billing.subscription.canceled';
  readonly type = SubscriptionCanceledEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly subscriptionId: string;
  readonly workspaceId: string;
  readonly planCode: string;

  constructor(
    subscriptionId: string,
    workspaceId: string,
    planCode: string,
  ) {
    this.subscriptionId = subscriptionId;
    this.workspaceId = workspaceId;
    this.planCode = planCode;
    this.timestamp = new Date();
  }
}

export class SubscriptionRenewedEvent implements DomainEvent {
  static readonly TYPE = 'billing.subscription.renewed';
  readonly type = SubscriptionRenewedEvent.TYPE;
  readonly version = 1;
  readonly timestamp: Date;
  readonly subscriptionId: string;
  readonly workspaceId: string;
  readonly planCode: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;

  constructor(
    subscriptionId: string,
    workspaceId: string,
    planCode: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    this.subscriptionId = subscriptionId;
    this.workspaceId = workspaceId;
    this.planCode = planCode;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.timestamp = new Date();
  }
}