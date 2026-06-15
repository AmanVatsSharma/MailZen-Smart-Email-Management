/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/list-workspace-members/list-workspace-members.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for ListWorkspaceMembers use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ListWorkspaceMembersDto {
  workspaceId: string;
  actorUserId: string;
}
