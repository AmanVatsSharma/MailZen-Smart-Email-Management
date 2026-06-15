/**
 * File:        apps/backend/src/core/testing/in-memory-attachment.repository.ts
 * Module:      Core · Testing
 * Purpose:     In-memory IAttachmentRepository fake.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { IAttachmentRepository } from 'application/ports/repositories/attachment.repository';
import { Attachment } from '../domain/bounded-contexts/messaging/attachment.entity';
import { EmailId } from '../domain/shared/value-objects/ids';

export class InMemoryAttachmentRepository implements IAttachmentRepository {
  private readonly store = new Map<string, Attachment>();

  async save(attachment: Attachment): Promise<void> {
    this.store.set(attachment.id, attachment);
  }

  async findById(id: string): Promise<Attachment | null> {
    return this.store.get(id) ?? null;
  }

  async listByEmail(emailId: EmailId): Promise<Attachment[]> {
    return [...this.store.values()].filter((a) => a.emailId === emailId);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
