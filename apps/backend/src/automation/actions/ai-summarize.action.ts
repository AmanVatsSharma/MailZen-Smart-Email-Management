/**
 * File:        apps/backend/src/automation/actions/ai-summarize.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Summarizes an email thread via InboxAiService.summarizeThread.
 *              Returns skipped=true if the AI provider is unavailable or the
 *              thread cannot be found — never fails the run.
 *
 * Exports:
 *   - AiSummarizeActionHandler  — Injectable handler for 'ai.summarize'
 *
 * Depends on:
 *   - InboxAiService             — summarizeThread(messages)
 *   - ExternalEmailMessage repo  — loads thread messages for the summarizer
 *
 * Side-effects:
 *   - HTTP call to OpenAI API (gated by SMART_REPLY_USE_OPENAI=true)
 *
 * Key invariants:
 *   - creditsConsumed: 1 per successful summary (billing invariant §2.4)
 *   - Null from summarizeThread → skipped=true (AI unavailable, not step failure)
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
export class AiSummarizeActionHandler implements ActionHandler {
  readonly actionType = 'ai.summarize' as const;

  constructor(
    private readonly inboxAiService: InboxAiService,
    @InjectRepository(ExternalEmailMessage)
    private readonly messageRepo: Repository<ExternalEmailMessage>,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'ai.summarize') return { skipped: true };

    const event = ctx.triggerEvent as Record<string, unknown>;
    const threadId = (event['threadId'] ?? event['messageId']) as string | undefined;
    if (!threadId) return { skipped: true };

    const messages = await this.messageRepo.find({
      where: [
        { userId: ctx.userId, threadId },
        { userId: ctx.userId, externalMessageId: threadId },
      ],
      order: { internalDate: 'DESC' },
      take: 10,
    });

    if (!messages.length) return { skipped: true };

    const summary = await this.inboxAiService.summarizeThread(messages).catch(() => null);
    if (!summary) return { skipped: true };

    return {
      data: { summary },
      creditsConsumed: 1,
    };
  }
}
