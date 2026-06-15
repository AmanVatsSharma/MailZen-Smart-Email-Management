/**
 * File:        apps/backend/src/core/testing/in-memory-mailbox.repository.ts
 * Module:      Testing · Fake
 * Purpose:     In-memory Mailbox repository for unit tests. Implements
 *              IMailboxRepository contract.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IMailboxRepository } from '../application/ports/repositories/mailbox.repository';
import { Mailbox } from '../domain/bounded-contexts/mailbox/mailbox.aggregate';
import { ProviderType } from '../domain/bounded-contexts/mailbox/value-objects/provider-type';

export class InMemoryMailboxRepository implements IMailboxRepository {
  private mailboxes: Map<string, Mailbox> = new Map();

  async findById(id: string): Promise<Mailbox | null> {
    return this.mailboxes.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<Mailbox[]> {
    return Array.from(this.mailboxes.values()).filter((m) => m.userId === userId);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Mailbox[]> {
    return Array.from(this.mailboxes.values()).filter((m) => m.workspaceId === workspaceId);
  }

  async findByEmailAddress(emailAddress: string): Promise<Mailbox | null> {
    return Array.from(this.mailboxes.values()).find((m) => m.emailAddress === emailAddress) ?? null;
  }

  async findPrimaryByUserId(userId: string): Promise<Mailbox | null> {
    return Array.from(this.mailboxes.values()).find((m) => m.userId === userId && m.isPrimary) ?? null;
  }

  async findByProvider(provider: ProviderType, emailAddress: string): Promise<Mailbox | null> {
    return Array.from(this.mailboxes.values())
      .find((m) => m.provider === provider && m.emailAddress === emailAddress) ?? null;
  }

  async save(mailbox: Mailbox): Promise<void> {
    this.mailboxes.set(mailbox.id, mailbox);
  }

  async delete(id: string): Promise<void> {
    this.mailboxes.delete(id);
  }

  reset(): void {
    this.mailboxes.clear();
  }
}
