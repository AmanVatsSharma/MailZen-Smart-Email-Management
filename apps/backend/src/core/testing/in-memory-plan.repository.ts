/**
 * File:        apps/backend/src/core/testing/in-memory-plan.repository.ts
 * Module:      Testing Fakes
 * Purpose:     In-memory fake of IPlanRepository for unit tests
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../domain/shared/result';
import { Plan } from '../domain/bounded-contexts/billing/plan.aggregate';
import { IPlanRepository } from 'application/ports/repositories/plan.repository';

export class InMemoryPlanRepository implements IPlanRepository {
  public readonly items: Plan[] = [];

  async save(plan: Plan): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(p => p.id === plan.id);
    if (idx >= 0) {
      this.items[idx] = plan;
    } else {
      this.items.push(plan);
    }
    return Result.ok(undefined);
  }

  async saveMany(plans: Plan[]): Promise<Result<void, Error>> {
    for (const plan of plans) {
      await this.save(plan);
    }
    return Result.ok(undefined);
  }

  async findById(id: string): Promise<Plan | null> {
    return this.items.find(p => p.id === id) || null;
  }

  async findByCode(code: string): Promise<Plan | null> {
    return this.items.find(p => p.code === code) || null;
  }

  async findAllActive(): Promise<Plan[]> {
    return this.items.filter(p => p.isActive);
  }

  async findAll(): Promise<Plan[]> {
    return [...this.items];
  }

  async count(): Promise<number> {
    return this.items.length;
  }

  async existsByCode(code: string): Promise<boolean> {
    return this.items.some(p => p.code === code);
  }
}
