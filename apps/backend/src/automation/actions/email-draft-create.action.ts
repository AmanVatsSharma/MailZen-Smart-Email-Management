/**
 * File:        apps/backend/src/automation/actions/email-draft-create.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Creates an email draft row in DRAFT status so it can be reviewed
 *              before sending or passed to a downstream email.draft.send step.
 *
 * Exports:
 *   - EmailDraftCreateActionHandler  — Injectable handler for 'email.draft.create'
 *
 * Depends on:
 *   - EmailService.sendEmail  — used with DRAFT body; alternatively creates the row directly
 *   - Email repo              — direct insert as DRAFT to avoid triggering actual send
 *
 * Side-effects:
 *   - Inserts one row in the emails table with status='DRAFT'
 *
 * Key invariants:
 *   - subject/body resolved from step config; falls back to empty string if missing
 *   - to/from resolved from step config; if missing, falls back to trigger event fields
 *   - Returns draftId in output so a downstream email.draft.send step can use it
 *
 * Read order:
 *   1. execute()  — resolve fields → insert draft row → return draftId
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationStep, EmailDraftCreateStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { Email } from '../../email/entities/email.entity';

@Injectable()
export class EmailDraftCreateActionHandler implements ActionHandler {
  readonly actionType = 'email.draft.create' as const;

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'email.draft.create') return { skipped: true };

    const draftStep = step as EmailDraftCreateStep;
    const event = ctx.triggerEvent as Record<string, unknown>;

    const subject = draftStep.subject ?? String(event['subject'] ?? '(no subject)');
    const body = draftStep.body ?? '';
    const from = String(event['replyFrom'] ?? event['from'] ?? '');
    const to = [String(event['from'] ?? '')].filter(Boolean);

    const draft = this.emailRepo.create({
      userId: ctx.userId,
      subject,
      body,
      from,
      to,
      status: 'DRAFT',
    });
    const saved = await this.emailRepo.save(draft);

    return {
      data: { draftId: saved.id, subject },
    };
  }
}
