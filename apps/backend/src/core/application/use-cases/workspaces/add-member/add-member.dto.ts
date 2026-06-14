/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/add-member/add-member.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for AddMember use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Role } from '../../../../domain/bounded-contexts/workspaces/value-objects/role';

export interface AddMemberDto {
  workspaceId: string;
  email: string;
  role: Role;
  actorUserId: string;
  isReactivation?: boolean;
}
