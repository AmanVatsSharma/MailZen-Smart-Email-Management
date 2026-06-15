/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/export-workspace-data/export-workspace-data.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for ExportWorkspaceData use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ExportWorkspaceDataDto } from './export-workspace-data.dto';

export class ExportWorkspaceDataCommand {
  constructor(public readonly input: ExportWorkspaceDataDto) {}
}
