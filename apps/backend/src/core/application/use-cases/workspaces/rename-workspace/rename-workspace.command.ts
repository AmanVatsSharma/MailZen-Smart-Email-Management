/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/rename-workspace/rename-workspace.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for RenameWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RenameWorkspaceDto } from './rename-workspace.dto';

export class RenameWorkspaceCommand {
  constructor(public readonly input: RenameWorkspaceDto) {}
}
