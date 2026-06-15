/**
 * File:        apps/backend/src/core/testing/in-memory-membership.repository.ts
 * Module:      Testing Fakes
 * Purpose:     In-memory fake of IMembershipRepository for unit tests
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../domain/shared/result';
import { Membership } from '../domain/bounded-contexts/workspaces/membership.aggregate';
import { IMembershipRepository } from 'application/ports/repositories/membership.repository';

export class InMemoryMembershipRepository implements IMembershipRepository {
  public readonly items: Membership[] = [];

  async save(membership: Membership): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(m => m.id === membership.id);
    if (idx >= 0) {
      this.items[idx] = membership;
    } else {
      this.items.push(membership);
    }
    return Result.ok(undefined);
  }

  async findById(id: string): Promise<Membership | null> {
    return this.items.find(m => m.id === id) || null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Membership[]> {
    return this.items.filter(m => m.workspaceId === workspaceId);
  }

  async findByWorkspaceAndEmail(workspaceId: string, email: string): Promise<Membership | null> {
    return this.items.find(m => m.workspaceId === workspaceId && m.email === email) || null;
  }

  async findByUserId(userId: string): Promise<Membership[]> {
    return this.items.filter(m => m.userId === userId);
  }

  async findByEmail(email: string): Promise<Membership[]> {
    return this.items.filter(m => m.email === email);
  }

  async findOwnersByWorkspaceId(workspaceId: string): Promise<Membership[]> {
    return this.items.filter(m => m.workspaceId === workspaceId && m.role === 'OWNER');
  }

  async countActiveByWorkspaceId(workspaceId: string): Promise<number> {
    return this.items.filter(m => m.workspaceId === workspaceId && m.status === 'active').length;
  }

  async delete(id: string): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(m => m.id === id);
    if (idx >= 0) this.items.splice(idx, 1);
    return Result.ok(undefined);
  }
}
