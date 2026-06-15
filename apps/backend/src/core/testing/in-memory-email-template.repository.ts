/**
 * File:        apps/backend/src/core/testing/in-memory-email-template.repository.ts
 * Module:      Core · Testing
 * Purpose:     In-memory IEmailTemplateRepository fake.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { IEmailTemplateRepository } from 'application/ports/repositories/email-template.repository';
import { EmailTemplate } from '../domain/bounded-contexts/messaging/email-template.aggregate';
import { UserId } from '../domain/shared/value-objects/ids';

export class InMemoryEmailTemplateRepository implements IEmailTemplateRepository {
  private readonly store = new Map<string, EmailTemplate>();

  async save(template: EmailTemplate): Promise<void> {
    this.store.set(template.id, template);
  }

  async findById(id: string): Promise<EmailTemplate | null> {
    return this.store.get(id) ?? null;
  }

  async listByOwner(_userId: UserId): Promise<EmailTemplate[]> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
