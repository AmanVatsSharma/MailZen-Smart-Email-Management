/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/remove-member/remove-member.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for RemoveMember use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface RemoveMemberDto {
  membershipId: string;
  actorUserId: string;
}
