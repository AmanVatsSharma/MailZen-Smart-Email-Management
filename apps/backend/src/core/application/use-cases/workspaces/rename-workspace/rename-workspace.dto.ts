/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/rename-workspace/rename-workspace.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for RenameWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface RenameWorkspaceDto {
  workspaceId: string;
  newName: string;
  actorUserId: string;
}
