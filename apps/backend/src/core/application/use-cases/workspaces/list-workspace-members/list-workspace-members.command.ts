/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/list-workspace-members/list-workspace-members.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for ListWorkspaceMembers use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListWorkspaceMembersDto } from './list-workspace-members.dto';

export class ListWorkspaceMembersCommand {
  constructor(public readonly input: ListWorkspaceMembersDto) {}
}
