/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/change-member-role/change-member-role.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for ChangeMemberRole use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ChangeMemberRoleDto } from './change-member-role.dto';

export class ChangeMemberRoleCommand {
  constructor(public readonly input: ChangeMemberRoleDto) {}
}
