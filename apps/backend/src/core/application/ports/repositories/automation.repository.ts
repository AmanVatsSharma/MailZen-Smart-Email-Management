/**
 * File:        core/application/ports/repositories/automation.repository.ts
 * Module:      Application - Automation Bounded Context
 * Purpose:     Port for automation version persistence. Each save creates a new row.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Automation } from '../../../domain/bounded-contexts/automation/automation.aggregate';
import { Result } from '../../../domain/shared/result';

export const AUTOMATION_REPOSITORY = Symbol('IAutomationRepository');

export interface IAutomationRepository {
  save(automation: Automation): Promise<Result<void, Error>>;
  findByVersionId(versionId: string): Promise<Automation | null>;
  listForWorkspace(workspaceId: string): Promise<Automation[]>;
  findPublishedByWorkflowId(workflowId: string): Promise<Automation | null>;
}
