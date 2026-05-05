/**
 * File:        apps/backend/src/automation/triggers/email-label-added.trigger.ts
 * Module:      Automation Engine · Trigger
 * Purpose:     Normalizes an EmailLabelAddedEvent (published from email.service.ts
 *              after assignLabel) into a trigger event. Supports optional labelName
 *              filter on the trigger config — if set, only fires when the label name matches.
 *
 * Exports:
 *   - EmailLabelAddedTriggerHandler  — Injectable trigger handler for 'email.label.added'
 *
 * Depends on:
 *   - @mailzen/shared-types — AutomationTrigger, AutomationEvent, EmailLabelAddedTrigger
 *   - trigger.interface.ts  — TriggerHandler, TriggerContext
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - Returns null when messageId or labelId is missing
 *   - Returns null when trigger.labelName is set but doesn't match the event's labelName
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import { Injectable } from '@nestjs/common';
import { AutomationEvent, AutomationTrigger, EmailLabelAddedTrigger } from '@mailzen/shared-types';
import { TriggerContext, TriggerHandler } from './trigger.interface';

@Injectable()
export class EmailLabelAddedTriggerHandler implements TriggerHandler {
  readonly triggerType = 'email.label.added' as const;

  canHandle(trigger: AutomationTrigger): boolean {
    return trigger.type === 'email.label.added';
  }

  normalize(ctx: TriggerContext): AutomationEvent | null {
    const p = ctx.rawPayload;
    const messageId = String(p['messageId'] ?? p['emailId'] ?? '');
    const threadId = String(p['threadId'] ?? messageId);
    const labelId = String(p['labelId'] ?? '');
    const labelName = String(p['labelName'] ?? '');

    if (!messageId || !labelId) return null;

    // Apply labelName filter if set on the trigger config
    const triggerConfig = ctx.rawPayload['__trigger'] as EmailLabelAddedTrigger | undefined;
    if (triggerConfig?.labelName && triggerConfig.labelName !== labelName) return null;

    return {
      type: 'email.label.added',
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      messageId,
      threadId,
      labelId,
      labelName,
    };
  }
}
