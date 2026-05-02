/**
 * File:        apps/backend/src/automation/actions/notify-user.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Sends an in-app notification to a target user via the existing
 *              NotificationEventBusService.publishSafely pipeline.
 *
 * Exports:
 *   - NotifyUserActionHandler  — Injectable handler for 'notify.user'
 *
 * Depends on:
 *   - NotificationEventBusService  — publishSafely(event) from notification module
 *
 * Side-effects:
 *   - Writes user_notifications row via NotificationService
 *
 * Key invariants:
 *   - publishSafely never throws — failure is silently swallowed + logged there
 *   - If notification is null (failed silently), action returns skipped=false
 *     (the step itself did not fail; the downstream silently handled it)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable } from '@nestjs/common';
import { AutomationStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { NotificationEventBusService } from '../../notification/notification-event-bus.service';

@Injectable()
export class NotifyUserActionHandler implements ActionHandler {
  readonly actionType = 'notify.user' as const;

  constructor(private readonly notificationBus: NotificationEventBusService) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'notify.user') return { skipped: true };

    const notification = await this.notificationBus.publishSafely({
      userId: step.targetUserId,
      type: 'AUTOMATION_NOTIFICATION',
      title: step.title,
      message: step.message,
      metadata: {
        ...(step.metadata ?? {}),
        automationRunId: ctx.runId,
        correlationId: ctx.correlationId,
        workspaceId: ctx.workspaceId,
      },
    });

    return {
      data: { notificationId: notification?.id ?? null },
    };
  }
}
