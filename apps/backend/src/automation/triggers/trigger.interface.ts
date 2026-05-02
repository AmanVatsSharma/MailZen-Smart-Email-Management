/**
 * File:        apps/backend/src/automation/triggers/trigger.interface.ts
 * Module:      Automation Engine · Trigger Interface
 * Purpose:     Contract that all trigger handler implementations must satisfy.
 *              A trigger handler normalizes a raw provider event into the AutomationEvent
 *              discriminated union consumed by the AutomationDispatcher.
 *
 * Exports:
 *   - TriggerContext   — input shape passed to every trigger handler
 *   - TriggerHandler   — interface all trigger handlers implement
 *
 * Depends on:
 *   - @mailzen/shared-types — AutomationEvent, AutomationTrigger
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - canHandle() must be a pure function — no side effects, no I/O
 *   - normalize() maps raw provider payloads; may return null if normalization fails
 *     (dispatcher treats null as "skip", not as an error)
 *
 * Read order:
 *   1. TriggerContext  — the input
 *   2. TriggerHandler  — the interface
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { AutomationEvent, AutomationTrigger, AutomationTriggerType } from '@mailzen/shared-types';

export type TriggerContext = {
  workspaceId: string;
  userId: string;
  /** Raw payload from the upstream source (gmail-sync, outlook-sync, etc.) */
  rawPayload: Record<string, unknown>;
  correlationId?: string;
};

export interface TriggerHandler {
  /** The trigger type this handler owns */
  readonly triggerType: AutomationTriggerType;

  /**
   * Returns true if this handler should process the given trigger config.
   * Called before normalize() to short-circuit non-matching handlers.
   */
  canHandle(trigger: AutomationTrigger): boolean;

  /**
   * Maps the raw context to a normalized AutomationEvent.
   * Returns null if normalization is impossible (missing required fields, etc.).
   */
  normalize(ctx: TriggerContext): AutomationEvent | null;
}
