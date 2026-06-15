/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/export-workspace-data/export-workspace-data.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for ExportWorkspaceData use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ExportWorkspaceDataDto {
  workspaceId: string;
  actorUserId: string;
  isAdmin?: boolean;
}

export interface WorkspaceDataExportPayload {
  generatedAtIso: string;
  dataJson: string;
  memberCount: number;
}
