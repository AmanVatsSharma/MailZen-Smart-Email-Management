/**
 * File:        apps/backend/src/core/testing/in-memory-email-provider.repository.ts
 * Module:      Testing · Fake
 * Purpose:     In-memory EmailProvider repository for unit tests.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IEmailProviderRepository } from 'application/ports/repositories/email-provider.repository';
import { EmailProvider } from '../domain/bounded-contexts/mailbox/email-provider.aggregate';

export class InMemoryEmailProviderRepository implements IEmailProviderRepository {
  private providers: Map<string, EmailProvider> = new Map();

  async findById(id: string): Promise<EmailProvider | null> {
    return this.providers.get(id) ?? null;
  }

  async findByMailboxId(mailboxId: string): Promise<EmailProvider | null> {
    return Array.from(this.providers.values()).find((p) => p.mailboxId === mailboxId) ?? null;
  }

  async save(provider: EmailProvider): Promise<void> {
    this.providers.set(provider.id, provider);
  }

  async delete(id: string): Promise<void> {
    this.providers.delete(id);
  }

  reset(): void {
    this.providers.clear();
  }
}
