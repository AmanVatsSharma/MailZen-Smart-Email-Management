/**
 * File:        apps/backend/src/core/testing/in-memory-email.repository.ts
 * Module:      Core · Testing
 * Purpose:     In-memory IEmailRepository fake. Stores Email aggregates by id;
 *              supports the same listing filter shape as the production
 *              repository. Used in handler specs.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  EmailListFilter,
  EmailListResult,
  IEmailRepository,
} from '../application/ports/repositories/email.repository';
import { Email } from '../domain/bounded-contexts/messaging/email.aggregate';
import { EmailId } from '../domain/shared/value-objects/ids';

export class InMemoryEmailRepository implements IEmailRepository {
  private readonly store = new Map<string, Email>();

  async save(email: Email): Promise<void> {
    this.store.set(email.id, email);
  }

  async findById(id: EmailId): Promise<Email | null> {
    return this.store.get(id) ?? null;
  }

  async list(filter: EmailListFilter): Promise<EmailListResult> {
    const all = [...this.store.values()].filter((e) => {
      // Email aggregate does not expose props directly; use the public surface
      // for filtering. status checks use the aggregate's status getter.
      if (filter.status && e.status !== filter.status) return false;
      if (filter.threadId && e.threadId !== filter.threadId) return false;
      return true;
    });
    return {
      items: all.slice(filter.offset, filter.offset + filter.limit),
      total: all.length,
    };
  }

  async delete(id: EmailId): Promise<void> {
    this.store.delete(id);
  }

  async findScheduledBefore(when: Date): Promise<Email[]> {
    return [...this.store.values()].filter(
      (e) => e.scheduledAt !== null && e.scheduledAt.getTime() <= when.getTime(),
    );
  }
}
