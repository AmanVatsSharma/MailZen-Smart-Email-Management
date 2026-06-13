/**
 * File:        apps/backend/src/core/application/ports/repositories/plan.repository.ts
 * Module:      Application Ports
 * Purpose:     Port for persisting Plan aggregate
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Plan } from '../../../domain/bounded-contexts/billing/plan.aggregate';
import { Result } from '../../../domain/shared/result';

export const PLAN_REPOSITORY = Symbol('IPlanRepository');

export interface IPlanRepository {
  save(plan: Plan): Promise<Result<void, Error>>;
  saveMany(plans: Plan[]): Promise<Result<void, Error>>;
  findById(id: string): Promise<Plan | null>;
  findByCode(code: string): Promise<Plan | null>;
  findAllActive(): Promise<Plan[]>;
  findAll(): Promise<Plan[]>;
  count(): Promise<number>;
  existsByCode(code: string): Promise<boolean>;
}