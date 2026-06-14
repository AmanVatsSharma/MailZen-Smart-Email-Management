/**
 * File:        apps/backend/src/core/application/use-cases/unified-inbox/list-threads/list-threads.dto.ts
 * Module:      Unified Inbox Use Cases
 * Purpose:     Data transfer object for ListThreads use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ListThreadsDto {
  userId: string;
  workspaceId: string;
  folderId?: string;
  limit: number;
  offset: number;
}
