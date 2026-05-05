/**
 * File:        apps/backend/src/automation/actions/ai-draft-reply.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Generates a draft reply for the triggering email thread via
 *              InboxAiService.composeReplyDraft. The draft text is stored in the
 *              step output — it is NOT automatically sent (see email.draft.send).
 *
 * Exports:
 *   - AiDraftReplyActionHandler  — Injectable handler for 'ai.draft.reply'
 *
 * Depends on:
 *   - InboxAiService             — composeReplyDraft(messages)
 *   - ExternalEmailMessage repo  — loads thread messages for the reply generator
 *
 * Side-effects:
 *   - HTTP call to OpenAI API (gated by SMART_REPLY_USE_OPENAI=true)
 *
 * Key invariants:
 *   - creditsConsumed: 1 per successful draft (billing invariant §2.4)
 *   - Null from composeReplyDraft → skipped=true (AI unavailable, not step failure)
 *   - Draft text lives in output.draft — a downstream email.draft.send step uses it
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-05
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { InboxAiService } from '../../ai-agent-gateway/inbox-ai.service';
import { ExternalEmailMessage } from '../../email-integration/entities/external-email-message.entity';

@Injectable()
export class AiDraftReplyActionHandler implements ActionHandler {
  readonly actionType = 'ai.draft.reply' as const;

  constructor(
    private readonly inboxAiService: InboxAiService,
    @InjectRepository(ExternalEmailMessage)
    private readonly messageRepo: Repository<ExternalEmailMessage>,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'ai.draft.reply') return { skipped: true };

    const event = ctx.triggerEvent as Record<string, unknown>;
    const threadId = (event['threadId'] ?? event['messageId']) as string | undefined;
    if (!threadId) return { skipped: true };

    const messages = await this.messageRepo.find({
      where: [
        { userId: ctx.userId, threadId },
        { userId: ctx.userId, externalMessageId: threadId },
      ],
      order: { internalDate: 'ASC' },
      take: 10,
    });

    if (!messages.length) return { skipped: true };

    const draft = await this.inboxAiService.composeReplyDraft(messages).catch(() => null);
    if (!draft) return { skipped: true };

    return {
      data: { draft, threadId },
      creditsConsumed: 1,
    };
  }
}
