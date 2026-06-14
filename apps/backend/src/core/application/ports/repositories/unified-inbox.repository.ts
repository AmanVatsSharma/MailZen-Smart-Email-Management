/**
 * File:        core/application/ports/repositories/unified-inbox.repository.ts
 * Module:      Application - Unified Inbox Bounded Context
 * Purpose:     Port for unified-thread (cross-provider) persistence.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { InboxFolder, UnifiedThread } from '../../../domain/bounded-contexts/unified-inbox/unified-thread.aggregate';
import { Result } from '../../../domain/shared/result';
import { UserId, WorkspaceId } from '../../../domain/shared/value-objects/ids';

export const UNIFIED_THREAD_REPOSITORY = Symbol('IUnifiedThreadRepository');
export const INBOX_FOLDER_REPOSITORY = Symbol('IInboxFolderRepository');

export interface IUnifiedThreadRepository {
  save(thread: UnifiedThread): Promise<Result<void, Error>>;
  findById(id: string): Promise<UnifiedThread | null>;
  listForUser(filter: {
    userId: UserId;
    workspaceId: WorkspaceId;
    folderId?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: UnifiedThread[]; total: number }>;
}

export interface IInboxFolderRepository {
  save(folder: InboxFolder): Promise<Result<void, Error>>;
  listForUser(userId: UserId, workspaceId: WorkspaceId): Promise<InboxFolder[]>;
}
