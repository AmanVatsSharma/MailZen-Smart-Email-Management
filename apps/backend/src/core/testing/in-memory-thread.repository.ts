/**
 * File:        apps/backend/src/core/testing/in-memory-thread.repository.ts
 * Module:      Core · Testing
 * Purpose:     In-memory IThreadRepository fake.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { IThreadRepository } from 'application/ports/repositories/thread.repository';
import { Thread } from '../domain/bounded-contexts/messaging/thread.aggregate';
import { ThreadId, WorkspaceId } from '../domain/shared/value-objects/ids';

export class InMemoryThreadRepository implements IThreadRepository {
  private readonly store = new Map<string, Thread>();

  async save(thread: Thread): Promise<void> {
    this.store.set(thread.id, thread);
  }

  async findById(id: ThreadId): Promise<Thread | null> {
    return this.store.get(id) ?? null;
  }

  async listByWorkspace(_workspaceId: WorkspaceId): Promise<Thread[]> {
    return [...this.store.values()];
  }
}
