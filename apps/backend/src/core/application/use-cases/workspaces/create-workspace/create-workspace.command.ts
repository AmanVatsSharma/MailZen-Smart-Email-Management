/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/create-workspace/create-workspace.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for CreateWorkspace use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { CreateWorkspaceDto } from './create-workspace.dto';

export class CreateWorkspaceCommand {
  constructor(public readonly input: CreateWorkspaceDto) {}
}
