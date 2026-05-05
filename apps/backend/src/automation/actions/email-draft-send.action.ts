/**
 * File:        apps/backend/src/automation/actions/email-draft-send.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Automatically sends an email draft as part of an automation run.
 *              This is a high-consequence action — gated by workspace.autoSendEnabled
 *              (default false). If not enabled, the step is skipped safely.
 *
 * Exports:
 *   - EmailDraftSendActionHandler  — Injectable handler for 'email.draft.send'
 *
 * Depends on:
 *   - Workspace repo    — checks autoSendEnabled gate
 *   - EmailService      — sendEmail() for actual dispatch
 *   - Email repo        — fetches draft email by draftId or from previous step output
 *
 * Side-effects:
 *   - Sends a real outbound email if autoSendEnabled = true
 *   - Writes email row and audit_log row (via EmailService.sendEmail)
 *
 * Key invariants:
 *   - Returns skipped=true when workspace.autoSendEnabled = false (safe default)
 *   - Draft resolved from: (1) step.draftId, (2) previous step output.draftId,
 *     (3) context messageId. Returns skipped=true if no draft found.
 *   - Fails fast with a thrown error if draft exists but cannot be sent (retried by worker)
 *
 * Read order:
 *   1. execute()  — safety gate → draft resolution → send
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationStep, EmailDraftSendStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { EmailService } from '../../email/email.service';
import { Email } from '../../email/entities/email.entity';
import { Workspace } from '../../workspace/entities/workspace.entity';
import { serializeStructuredLog } from '../../common/logging/structured-log.util';

@Injectable()
export class EmailDraftSendActionHandler implements ActionHandler {
  private readonly logger = new Logger(EmailDraftSendActionHandler.name);
  readonly actionType = 'email.draft.send' as const;

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    private readonly emailService: EmailService,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'email.draft.send') return { skipped: true };

    const workspace = await this.workspaceRepo.findOne({ where: { id: ctx.workspaceId } });
    if (!workspace?.autoSendEnabled) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'automation_draft_send_skipped_not_enabled',
          workspaceId: ctx.workspaceId,
          runId: ctx.runId,
          correlationId: ctx.correlationId,
        }),
      );
      return { skipped: true };
    }

    const sendStep = step as EmailDraftSendStep;

    // Resolve draftId: from step → from previous step output → from trigger event
    let draftId = sendStep.draftId;
    if (!draftId) {
      for (const output of Object.values(ctx.previousStepOutputs)) {
        const candidate = (output?.data as Record<string, unknown> | undefined)?.['draftId'];
        if (typeof candidate === 'string') {
          draftId = candidate;
          break;
        }
      }
    }
    if (!draftId) {
      const event = ctx.triggerEvent as Record<string, unknown>;
      draftId = (event['messageId'] ?? event['draftId']) as string | undefined;
    }

    if (!draftId) return { skipped: true };

    const draft = await this.emailRepo.findOne({
      where: { id: draftId, userId: ctx.userId, status: 'DRAFT' },
    });
    if (!draft) return { skipped: true };

    await this.emailService.sendEmail(
      {
        subject: draft.subject,
        body: draft.body ?? '',
        from: draft.from,
        to: draft.to ?? [],
        providerId: draft.providerId,
      },
      ctx.userId,
    );

    return {
      data: { draftId, sentAt: new Date().toISOString() },
    };
  }
}
