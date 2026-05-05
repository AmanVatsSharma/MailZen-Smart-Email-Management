/**
 * File:        apps/backend/src/automation/triggers/email-thread-replied.trigger.ts
 * Module:      Automation Engine · Trigger
 * Purpose:     Normalizes an EmailThreadRepliedEvent (published from email.service.ts after
 *              an outbound send on a thread) into a trigger event the dispatcher can match.
 *
 * Exports:
 *   - EmailThreadRepliedTriggerHandler  — Injectable trigger handler for 'email.thread.replied'
 *
 * Depends on:
 *   - @mailzen/shared-types — AutomationTrigger, AutomationEvent, EmailThreadRepliedEvent
 *   - trigger.interface.ts  — TriggerHandler, TriggerContext
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - Returns null when messageId or replyFrom is missing
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import { Injectable } from '@nestjs/common';
import { AutomationEvent, AutomationTrigger } from '@mailzen/shared-types';
import { TriggerContext, TriggerHandler } from './trigger.interface';

@Injectable()
export class EmailThreadRepliedTriggerHandler implements TriggerHandler {
  readonly triggerType = 'email.thread.replied' as const;

  canHandle(trigger: AutomationTrigger): boolean {
    return trigger.type === 'email.thread.replied';
  }

  normalize(ctx: TriggerContext): AutomationEvent | null {
    const p = ctx.rawPayload;
    const messageId = String(p['messageId'] ?? '');
    const threadId = String(p['threadId'] ?? messageId);
    const replyFrom = String(p['replyFrom'] ?? p['from'] ?? '');

    if (!messageId || !replyFrom) return null;

    return {
      type: 'email.thread.replied',
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      messageId,
      threadId,
      replyFrom,
    };
  }
}
