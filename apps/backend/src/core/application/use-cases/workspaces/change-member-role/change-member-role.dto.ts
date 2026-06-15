/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/change-member-role/change-member-role.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for ChangeMemberRole use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Role } from '../../../../domain/bounded-contexts/workspaces/value-objects/role';

export interface ChangeMemberRoleDto {
  membershipId: string;
  newRole: Role;
  actorUserId: string;
}
