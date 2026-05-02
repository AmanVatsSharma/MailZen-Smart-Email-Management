/**
 * File:        apps/backend/src/automation/triggers/email-received.trigger.ts
 * Module:      Automation Engine · Trigger
 * Purpose:     Normalizes a raw inbound-email payload (from gmail-sync / outlook-sync)
 *              into an EmailReceivedEvent consumed by the AutomationDispatcher.
 *
 * Exports:
 *   - EmailReceivedTriggerHandler  — Injectable trigger handler for 'email.received'
 *
 * Depends on:
 *   - @mailzen/shared-types — EmailReceivedTrigger, EmailReceivedEvent, AutomationEvent
 *   - trigger.interface.ts  — TriggerHandler, TriggerContext
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - Returns null (not throws) when required fields are missing from rawPayload
 *   - Callers (dispatcher) treat null as "skip this handler"
 *
 * Read order:
 *   1. EmailReceivedTriggerHandler.canHandle — fast guard
 *   2. EmailReceivedTriggerHandler.normalize — payload extraction
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable } from '@nestjs/common';
import { AutomationEvent, AutomationTrigger } from '@mailzen/shared-types';
import { TriggerContext, TriggerHandler } from './trigger.interface';

@Injectable()
export class EmailReceivedTriggerHandler implements TriggerHandler {
  readonly triggerType = 'email.received' as const;

  canHandle(trigger: AutomationTrigger): boolean {
    return trigger.type === 'email.received';
  }

  normalize(ctx: TriggerContext): AutomationEvent | null {
    const p = ctx.rawPayload;
    const messageId = String(p['messageId'] ?? p['id'] ?? '');
    const threadId = String(p['threadId'] ?? messageId);
    const from = String(p['from'] ?? p['fromAddress'] ?? '');
    const subject = String(p['subject'] ?? '');
    const labels = Array.isArray(p['labels']) ? p['labels'].map(String) : [];

    if (!messageId || !from) return null;

    return {
      type: 'email.received',
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      messageId,
      threadId,
      from,
      subject,
      labels,
    };
  }
}
