/**
 * File:        apps/backend/src/automation/triggers/schedule-cron.trigger.ts
 * Module:      Automation Engine · Trigger
 * Purpose:     Normalizes a ScheduleCronEvent (published by AutomationCronScheduler
 *              every minute for due automations) into a trigger event for the dispatcher.
 *
 * Exports:
 *   - ScheduleCronTriggerHandler  — Injectable trigger handler for 'schedule.cron'
 *
 * Depends on:
 *   - @mailzen/shared-types — AutomationTrigger, AutomationEvent
 *   - trigger.interface.ts  — TriggerHandler, TriggerContext
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - Returns null when automationId or scheduledAt is missing from payload
 *   - The cron scheduler (not this handler) is responsible for calculating next-fire time
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import { Injectable } from '@nestjs/common';
import { AutomationEvent, AutomationTrigger } from '@mailzen/shared-types';
import { TriggerContext, TriggerHandler } from './trigger.interface';

@Injectable()
export class ScheduleCronTriggerHandler implements TriggerHandler {
  readonly triggerType = 'schedule.cron' as const;

  canHandle(trigger: AutomationTrigger): boolean {
    return trigger.type === 'schedule.cron';
  }

  normalize(ctx: TriggerContext): AutomationEvent | null {
    const p = ctx.rawPayload;
    const automationId = String(p['automationId'] ?? '');
    const rawScheduledAt = p['scheduledAt'];

    if (!automationId || !rawScheduledAt) return null;

    const scheduledAt = rawScheduledAt instanceof Date ? rawScheduledAt : new Date(String(rawScheduledAt));
    if (isNaN(scheduledAt.getTime())) return null;

    return {
      type: 'schedule.cron',
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      correlationId: ctx.correlationId,
      automationId,
      scheduledAt,
    };
  }
}
