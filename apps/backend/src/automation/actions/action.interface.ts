/**
 * File:        apps/backend/src/automation/actions/action.interface.ts
 * Module:      Automation Engine · Action Interface
 * Purpose:     Contract that all action handler implementations must satisfy.
 *              The worker processor calls execute() for each step in a run, persisting
 *              the output in automation_step_runs.output.
 *
 * Exports:
 *   - ActionContext   — runtime context passed to every action handler
 *   - ActionResult    — shape of the output persisted in automation_step_runs.output
 *   - ActionHandler   — interface all action handlers implement
 *
 * Depends on:
 *   - @mailzen/shared-types — AutomationStep, AutomationActionType, AutomationEvent
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - execute() may throw; the worker processor handles retry logic externally
 *   - creditsConsumed must be set to a non-zero value for any ai.* step type
 *   - output is stored as-is in jsonb — keep it serializable (no class instances)
 *   - skipped = true signals the step was intentionally skipped (not failed)
 *     e.g., ai.classify when AI provider is unavailable
 *
 * Read order:
 *   1. ActionContext  — what the handler receives
 *   2. ActionResult   — what the handler must return
 *   3. ActionHandler  — the interface
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { AutomationActionType, AutomationEvent, AutomationStep } from '@mailzen/shared-types';

export type ActionContext = {
  workspaceId: string;
  userId: string;
  runId: string;
  stepIndex: number;
  correlationId: string;
  /** The normalized event that triggered this automation run */
  triggerEvent: AutomationEvent;
  /** Output from previous steps, keyed by step index */
  previousStepOutputs: Record<number, ActionResult>;
};

export type ActionResult = {
  /** Arbitrary output data — stored as jsonb in automation_step_runs.output */
  data?: Record<string, unknown>;
  /** Set to true when the step was intentionally skipped rather than executed */
  skipped?: boolean;
  /** AI credit units consumed by this step (required for ai.* types) */
  creditsConsumed?: number;
};

export interface ActionHandler {
  /** The action type this handler owns */
  readonly actionType: AutomationActionType;

  /**
   * Executes the action step. May throw on unrecoverable errors.
   * Worker processor handles retry (max 3, exponential backoff).
   */
  execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult>;
}
