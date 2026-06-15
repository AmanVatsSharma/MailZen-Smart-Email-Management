/**
 * File:        apps/backend/src/core/testing/in-memory-workspace.repository.ts
 * Module:      Testing Fakes
 * Purpose:     In-memory fake of IWorkspaceRepository for unit tests
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../domain/shared/result';
import { Workspace } from '../domain/bounded-contexts/workspaces/workspace.aggregate';
import { IWorkspaceRepository } from 'application/ports/repositories/workspace.repository';

export class InMemoryWorkspaceRepository implements IWorkspaceRepository {
  public readonly items: Workspace[] = [];

  async save(workspace: Workspace): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(w => w.id === workspace.id);
    if (idx >= 0) {
      this.items[idx] = workspace;
    } else {
      this.items.push(workspace);
    }
    return Result.ok(undefined);
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.items.find(w => w.id === id) || null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return this.items.find(w => w.slug === slug) || null;
  }

  async findByOwnerId(ownerUserId: string): Promise<Workspace[]> {
    return this.items.filter(w => w.ownerUserId === ownerUserId);
  }

  async findByOwnerAndSlug(ownerUserId: string, slug: string): Promise<Workspace | null> {
    return this.items.find(w => w.ownerUserId === ownerUserId && w.slug === slug) || null;
  }

  async delete(id: string): Promise<Result<void, Error>> {
    const idx = this.items.findIndex(w => w.id === id);
    if (idx >= 0) this.items.splice(idx, 1);
    return Result.ok(undefined);
  }

  async existsWithSlug(slug: string): Promise<boolean> {
    return this.items.some(w => w.slug === slug);
  }

  async updateActiveWorkspace(userId: string, workspaceId: string | null): Promise<Result<void, Error>> {
    return Result.ok(undefined);
  }
}
