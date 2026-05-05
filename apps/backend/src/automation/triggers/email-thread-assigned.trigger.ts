/**
 * File:        apps/backend/src/automation/triggers/email-thread-assigned.trigger.ts
 * Module:      Automation Engine · Trigger
 * Purpose:     Normalizes an EmailThreadAssignedEvent (published from
 *              email-assignment.service.ts after assignEmail) into a trigger event.
 *
 * Exports:
 *   - EmailThreadAssignedTriggerHandler  — Injectable trigger handler for 'email.thread.assigned'
 *
 * Depends on:
 *   - @mailzen/shared-types — AutomationTrigger, AutomationEvent
 *   - trigger.interface.ts  — TriggerHandler, TriggerContext
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - Returns null when threadId or assignedToUserId is missing
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import { Injectable } from '@nestjs/common';
import { AutomationEvent, AutomationTrigger } from '@mailzen/shared-types';
import { TriggerContext, TriggerHandler } from './trigger.interface';

@Injectable()
export class EmailThreadAssignedTriggerHandler implements TriggerHandler {
  readonly triggerType = 'email.thread.assigned' as const;

  canHandle(trigger: AutomationTrigger): boolean {
    return trigger.type === 'email.thread.assigned';
  }

  normalize(ctx: TriggerContext): AutomationEvent | null {
    const p = ctx.rawPayload;
    const threadId = String(p['threadId'] ?? p['emailId'] ?? '');
    const assignedToUserId = String(p['assignedToUserId'] ?? '');
    const assignedByUserId = String(p['assignedByUserId'] ?? ctx.userId);

    if (!threadId || !assignedToUserId) return null;

    return {
      type: 'email.thread.assigned',
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      threadId,
      assignedToUserId,
      assignedByUserId,
    };
  }
}
