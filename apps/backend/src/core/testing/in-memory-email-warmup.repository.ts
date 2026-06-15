/**
 * File:        apps/backend/src/core/testing/in-memory-email-warmup.repository.ts
 * Module:      Core · Testing
 * Purpose:     In-memory IEmailWarmupRepository fake.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { IEmailWarmupRepository } from '../application/ports/repositories/email-warmup.repository';
import { EmailWarmup } from '../domain/bounded-contexts/messaging/warmup.aggregate';

export class InMemoryEmailWarmupRepository implements IEmailWarmupRepository {
  private readonly store = new Map<string, EmailWarmup>();

  async save(warmup: EmailWarmup): Promise<void> {
    this.store.set(warmup.id, warmup);
  }

  async findById(id: string): Promise<EmailWarmup | null> {
    return this.store.get(id) ?? null;
  }

  async findByProviderId(providerId: string): Promise<EmailWarmup | null> {
    for (const w of this.store.values()) {
      if (w.providerId === providerId) return w;
    }
    return null;
  }

  async listActive(): Promise<EmailWarmup[]> {
    return [...this.store.values()].filter((w) => w.status === 'ACTIVE');
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
