/**
 * File:        apps/backend/src/core/testing/in-memory-subscription.repository.ts
 * Module:      Testing Fakes
 * Purpose:     In-memory fake of ISubscriptionRepository for unit tests
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../domain/shared/result';
import { Subscription } from '../domain/bounded-contexts/billing/subscription.aggregate';
import { ISubscriptionRepository } from '../application/ports/repositories/subscription.repository';

export class InMemorySubscriptionRepository implements ISubscriptionRepository {
  public readonly items: Subscription[] = [];

  async save(subscription: Subscription): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(s => s.id === subscription.id);
    if (idx >= 0) {
      this.items[idx] = subscription;
    } else {
      this.items.push(subscription);
    }
    return Result.ok(undefined);
  }

  async findById(id: string): Promise<Subscription | null> {
    return this.items.find(s => s.id === id) || null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Subscription | null> {
    return this.items.find(s => s.workspaceId === workspaceId && s.status === 'active') || null;
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    return this.items.filter(s => s.workspaceId === userId);
  }

  async findActiveForUserId(userId: string): Promise<Subscription | null> {
    return this.items.find(s => s.workspaceId === userId && s.status === 'active') || null;
  }

  async findByPlanCode(planCode: string): Promise<Subscription[]> {
    return this.items.filter(s => s.planCode === planCode);
  }

  async delete(id: string): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(s => s.id === id);
    if (idx >= 0) this.items.splice(idx, 1);
    return Result.ok(undefined);
  }

  async update(id: string, updates: Partial<Subscription['props']>): Promise<Result<void, Error>> {
    const sub = await this.findById(id);
    if (!sub) return Result.err(new Error('Subscription not found'));
    Object.assign((sub as any).props, updates);
    return Result.ok(undefined);
  }
}
