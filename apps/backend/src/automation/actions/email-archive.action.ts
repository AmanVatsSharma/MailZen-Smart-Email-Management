/**
 * File:        apps/backend/src/automation/actions/email-archive.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Archives the email that triggered this automation run by setting
 *              its status to 'ARCHIVED' in the emails table.
 *
 * Exports:
 *   - EmailArchiveActionHandler  — Injectable handler for 'email.archive'
 *
 * Depends on:
 *   - Email entity / repository  — updates status column
 *
 * Side-effects:
 *   - Writes to emails table (status = 'ARCHIVED')
 *
 * Key invariants:
 *   - messageId resolved from triggerEvent.messageId
 *   - Scoped to ctx.userId; will not archive emails belonging to other users
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { Email } from '../../email/entities/email.entity';

@Injectable()
export class EmailArchiveActionHandler implements ActionHandler {
  readonly actionType = 'email.archive' as const;

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'email.archive') return { skipped: true };

    const messageId =
      (ctx.triggerEvent as Record<string, unknown>)['messageId'] as string | undefined;
    if (!messageId) return { skipped: true };

    await this.emailRepo.update(
      { id: messageId, userId: ctx.userId },
      { status: 'ARCHIVED' },
    );

    return { data: { messageId } };
  }
}
