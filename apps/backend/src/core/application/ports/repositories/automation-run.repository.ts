/**
 * File:        core/application/ports/repositories/automation-run.repository.ts
 * Module:      Application - Automation Bounded Context
 * Purpose:     Port for automation run log. Each save records one execution attempt.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../../../domain/shared/result';

export const AUTOMATION_RUN_REPOSITORY = Symbol('IAutomationRunRepository');

export interface AutomationRunRecord {
  id: string;
  automationVersionId: string;
  triggerEvent: unknown;
  status: 'success' | 'failed' | 'throttled' | 'pending';
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
}

export interface IAutomationRunRepository {
  save(run: AutomationRunRecord): Promise<Result<void, Error>>;
  listForAutomation(
    versionId: string,
    limit: number,
    offset: number,
  ): Promise<{ items: AutomationRunRecord[]; total: number }>;
}
