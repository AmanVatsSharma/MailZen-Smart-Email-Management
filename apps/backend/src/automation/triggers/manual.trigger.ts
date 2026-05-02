/**
 * File:        apps/backend/src/automation/triggers/manual.trigger.ts
 * Module:      Automation Engine · Trigger
 * Purpose:     Trigger handler for manually-fired automations (via runAutomationManually
 *              mutation). Passes contextOverride from the mutation input as the event payload.
 *
 * Exports:
 *   - ManualTriggerHandler  — Injectable trigger handler for 'manual'
 *
 * Depends on:
 *   - trigger.interface.ts  — TriggerHandler, TriggerContext
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - rawPayload must include automationId (set by the resolver before publishing)
 *   - contextOverride is forwarded as-is for testing / one-off invocations
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable } from '@nestjs/common';
import { AutomationEvent, AutomationTrigger } from '@mailzen/shared-types';
import { TriggerContext, TriggerHandler } from './trigger.interface';

@Injectable()
export class ManualTriggerHandler implements TriggerHandler {
  readonly triggerType = 'manual' as const;

  canHandle(trigger: AutomationTrigger): boolean {
    return trigger.type === 'manual';
  }

  normalize(ctx: TriggerContext): AutomationEvent | null {
    const automationId = String(ctx.rawPayload['automationId'] ?? '');
    if (!automationId) return null;

    return {
      type: 'manual',
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      automationId,
      contextOverride: ctx.rawPayload['contextOverride'] as Record<string, unknown> | undefined,
    };
  }
}
