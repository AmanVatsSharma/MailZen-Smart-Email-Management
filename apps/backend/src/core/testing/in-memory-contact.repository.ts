/**
 * File:        apps/backend/src/core/testing/in-memory-contact.repository.ts
 * Module:      Testing Fakes
 * Purpose:     In-memory fake of IContactRepository for unit tests
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../domain/shared/result';
import { Contact } from '../domain/bounded-contexts/contacts/contact.aggregate';
import { IContactRepository, ContactQueryFilter } from '../application/ports/repositories/contact.repository';

export class InMemoryContactRepository implements IContactRepository {
  public readonly items: Contact[] = [];

  async save(contact: Contact): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(c => c.id === contact.id);
    if (idx >= 0) {
      this.items[idx] = contact;
    } else {
      this.items.push(contact);
    }
    return Result.ok(undefined);
  }

  async findById(id: string): Promise<Contact | null> {
    return this.items.find(c => c.id === id) || null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Contact[]> {
    return this.items.filter(c => c.workspaceId === workspaceId);
  }

  async findByEmail(workspaceId: string, email: string): Promise<Contact | null> {
    return this.items.find(c => c.workspaceId === workspaceId && c.email === email.toLowerCase()) || null;
  }

  async findByIds(ids: string[]): Promise<Contact[]> {
    return this.items.filter(c => ids.includes(c.id));
  }

  async query(filter: ContactQueryFilter): Promise<{ items: Contact[]; total: number }> {
    let results = this.items.filter(c => c.workspaceId === filter.workspaceId);
    if (filter.tag) {
      const tag = filter.tag.toLowerCase();
      results = results.filter(c => c.tags.includes(tag));
    }
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      results = results.filter(c => c.displayName.toLowerCase().includes(term) || c.email.includes(term));
    }
    const total = results.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    return { items: results.slice(offset, offset + limit), total };
  }

  async delete(id: string): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(c => c.id === id);
    if (idx >= 0) this.items.splice(idx, 1);
    return Result.ok(undefined);
  }

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    return this.items.filter(c => c.workspaceId === workspaceId).length;
  }
}
