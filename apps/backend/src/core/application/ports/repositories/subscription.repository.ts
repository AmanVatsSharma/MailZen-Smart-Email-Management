/**
 * File:        apps/backend/src/core/application/ports/repositories/subscription.repository.ts
 * Module:      Application Ports
 * Purpose:     Port for persisting Subscription aggregate
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Subscription } from '../../../domain/bounded-contexts/billing/subscription.aggregate';
import { Result } from '../../../domain/shared/result';

export const SUBSCRIPTION_REPOSITORY = Symbol('ISubscriptionRepository');

export interface ISubscriptionRepository {
  save(subscription: Subscription): Promise<Result<void, Error>>;
  findById(id: string): Promise<Subscription | null>;
  findByWorkspaceId(workspaceId: string): Promise<Subscription | null>;
  findByUserId(userId: string): Promise<Subscription[]>;
  findActiveForUserId(userId: string): Promise<Subscription | null>;
  findByPlanCode(planCode: string): Promise<Subscription[]>;
  delete(id: string): Promise<Result<void, Error>>;
  update(id: string, updates: Partial<Subscription['props']>): Promise<Result<void, Error>>;
}