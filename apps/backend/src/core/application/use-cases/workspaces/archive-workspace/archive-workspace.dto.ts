/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/archive-workspace/archive-workspace.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for ArchiveWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ArchiveWorkspaceDto {
  workspaceId: string;
  actorUserId: string;
  archive: boolean;
}
