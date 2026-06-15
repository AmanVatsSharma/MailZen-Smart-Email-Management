/**
 * File:        apps/backend/src/core/testing/in-memory-email-filter.repository.ts
 * Module:      Core · Testing
 * Purpose:     In-memory IEmailFilterRepository fake.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  EmailFilterRecord,
  IEmailFilterRepository,
} from 'application/ports/repositories/email-filter.repository';
import { UserId } from '../domain/shared/value-objects/ids';

export class InMemoryEmailFilterRepository implements IEmailFilterRepository {
  private readonly store = new Map<string, EmailFilterRecord>();

  async save(record: EmailFilterRecord): Promise<void> {
    this.store.set(record.id, record);
  }

  async findById(id: string): Promise<EmailFilterRecord | null> {
    return this.store.get(id) ?? null;
  }

  async listByOwner(_userId: UserId): Promise<EmailFilterRecord[]> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
