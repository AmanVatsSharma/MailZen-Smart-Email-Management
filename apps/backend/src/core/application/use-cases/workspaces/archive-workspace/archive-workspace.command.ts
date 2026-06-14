/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/archive-workspace/archive-workspace.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for ArchiveWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ArchiveWorkspaceDto } from './archive-workspace.dto';

export class ArchiveWorkspaceCommand {
  constructor(public readonly input: ArchiveWorkspaceDto) {}
}
