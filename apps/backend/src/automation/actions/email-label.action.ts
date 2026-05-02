/**
 * File:        apps/backend/src/automation/actions/email-label.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Action handlers for email.label.add and email.label.remove.
 *              Resolves label by ID or name; creates label if createIfMissing=true.
 *
 * Exports:
 *   - EmailLabelAddActionHandler     — Injectable handler for 'email.label.add'
 *   - EmailLabelRemoveActionHandler  — Injectable handler for 'email.label.remove'
 *
 * Depends on:
 *   - EmailLabel entity              — for label lookup by name
 *   - EmailLabelAssignment entity    — for upsert/delete of label assignment
 *
 * Side-effects:
 *   - Writes to email_labels (if createIfMissing) and email_label_assignments
 *
 * Key invariants:
 *   - Label lookup is scoped to userId (from ActionContext.userId)
 *   - Missing label without createIfMissing returns skipped=true, not error
 *   - Remove of a non-existent assignment is a no-op (idempotent)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { EmailLabel } from '../../email/entities/email-label.entity';
import { EmailLabelAssignment } from '../../email/entities/email-label-assignment.entity';

async function resolveLabel(
  labelRepo: Repository<EmailLabel>,
  userId: string,
  labelId?: string,
  labelName?: string,
  createIfMissing?: boolean,
): Promise<EmailLabel | null> {
  if (labelId) {
    return labelRepo.findOne({ where: { id: labelId, userId } });
  }
  if (!labelName) return null;

  const existing = await labelRepo.findOne({ where: { name: labelName, userId } });
  if (existing) return existing;
  if (!createIfMissing) return null;

  return labelRepo.save(labelRepo.create({ name: labelName, userId, color: '#6366f1' }));
}

@Injectable()
export class EmailLabelAddActionHandler implements ActionHandler {
  readonly actionType = 'email.label.add' as const;

  constructor(
    @InjectRepository(EmailLabel)
    private readonly labelRepo: Repository<EmailLabel>,
    @InjectRepository(EmailLabelAssignment)
    private readonly assignmentRepo: Repository<EmailLabelAssignment>,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'email.label.add') return { skipped: true };

    const emailId =
      (ctx.triggerEvent as Record<string, unknown>)['messageId'] as string | undefined;
    if (!emailId) return { skipped: true };

    const label = await resolveLabel(
      this.labelRepo,
      ctx.userId,
      step.labelId,
      step.labelName,
      step.createIfMissing,
    );
    if (!label) return { skipped: true };

    await this.assignmentRepo.upsert(
      { emailId, labelId: label.id },
      { conflictPaths: ['emailId', 'labelId'] },
    );

    return { data: { labelId: label.id, labelName: label.name } };
  }
}

@Injectable()
export class EmailLabelRemoveActionHandler implements ActionHandler {
  readonly actionType = 'email.label.remove' as const;

  constructor(
    @InjectRepository(EmailLabel)
    private readonly labelRepo: Repository<EmailLabel>,
    @InjectRepository(EmailLabelAssignment)
    private readonly assignmentRepo: Repository<EmailLabelAssignment>,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'email.label.remove') return { skipped: true };

    const emailId =
      (ctx.triggerEvent as Record<string, unknown>)['messageId'] as string | undefined;
    if (!emailId) return { skipped: true };

    const label = await resolveLabel(this.labelRepo, ctx.userId, step.labelId, step.labelName);
    if (!label) return { skipped: true };

    await this.assignmentRepo.delete({ emailId, labelId: label.id });

    return { data: { labelId: label.id, labelName: label.name } };
  }
}
