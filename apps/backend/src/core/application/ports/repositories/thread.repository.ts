/**
 * File:        apps/backend/src/core/application/ports/repositories/thread.repository.ts
 * Module:      Core · Application · Ports
 * Purpose:     IThreadRepository port.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { Thread } from '../../../domain/bounded-contexts/messaging/thread.aggregate';
import { ThreadId, WorkspaceId } from '../../../domain/shared/value-objects/ids';

export const THREAD_REPOSITORY = Symbol('IThreadRepository');

export interface IThreadRepository {
  save(thread: Thread): Promise<void>;
  findById(id: ThreadId): Promise<Thread | null>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<Thread[]>;
}
