/**
 * File:        apps/backend/src/core/testing/in-memory-triage-result.repository.ts
 * Module:      Testing · Fake
 * Purpose:     In-memory TriageResult repository for unit tests.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ITriageResultRepository, TriageResultFilters } from '../application/ports/repositories/triage-result.repository';
import { TriageResult, TriagePriority, TriageCategory } from '../domain/bounded-contexts/ai/triage-result.aggregate';

export class InMemoryTriageResultRepository implements ITriageResultRepository {
  private results: Map<string, TriageResult> = new Map();

  async findById(id: string): Promise<TriageResult | null> {
    return this.results.get(id) ?? null;
  }

  async findByEmailId(emailId: string): Promise<TriageResult | null> {
    return Array.from(this.results.values()).find((r) => r.emailId === emailId) ?? null;
  }

  async findByUserId(userId: string, filters?: TriageResultFilters): Promise<TriageResult[]> {
    return Array.from(this.results.values()).filter((r) => {
      if (r.userId !== userId) return false;
      if (filters?.priority && r.priority !== filters.priority) return false;
      if (filters?.category && r.category !== filters.category) return false;
      return true;
    });
  }

  async save(result: TriageResult): Promise<void> {
    this.results.set(result.id, result);
  }

  async delete(id: string): Promise<void> {
    this.results.delete(id);
  }

  reset(): void {
    this.results.clear();
  }
}
