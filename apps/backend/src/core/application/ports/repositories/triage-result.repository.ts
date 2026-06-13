/**
 * File:        apps/backend/src/core/application/ports/repositories/triage-result.repository.ts
 * Module:      Application · Port
 * Purpose:     TriageResult repository port. Persistence operations
 *              for TriageResult aggregates.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { TriageResult } from '../../../domain/bounded-contexts/ai/triage-result.aggregate';
import { TriagePriority, TriageCategory } from '../../../domain/bounded-contexts/ai/triage-result.aggregate';

export interface TriageResultFilters {
  priority?: TriagePriority;
  category?: TriageCategory;
}

export interface ITriageResultRepository {
  findById(id: string): Promise<TriageResult | null>;
  findByEmailId(emailId: string): Promise<TriageResult | null>;
  findByUserId(userId: string, filters?: TriageResultFilters): Promise<TriageResult[]>;
  save(result: TriageResult): Promise<void>;
  delete(id: string): Promise<void>;
}

export const TRIAGE_RESULT_REPOSITORY = Symbol('ITriageResultRepository');
