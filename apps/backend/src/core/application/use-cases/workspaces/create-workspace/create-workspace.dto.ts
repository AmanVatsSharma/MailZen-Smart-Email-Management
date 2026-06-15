/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/create-workspace/create-workspace.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for CreateWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface CreateWorkspaceDto {
  userId: string;
  name: string;
  isPersonal?: boolean;
}
