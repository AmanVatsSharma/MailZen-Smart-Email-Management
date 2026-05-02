/**
 * File:        apps/backend/src/automation/actions/ai-classify.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Classifies the email thread using InboxAiService.classifyThread.
 *              On AI provider unavailability, returns skipped=true rather than failing
 *              the run — downstream conditions can branch on output == null.
 *
 * Exports:
 *   - AiClassifyActionHandler  — Injectable handler for 'ai.classify'
 *
 * Depends on:
 *   - InboxAiService            — classifyThread(messages)
 *   - ExternalEmailMessage repo — loads thread messages for the classifier
 *
 * Side-effects:
 *   - HTTP call to OpenAI API (gated by SMART_REPLY_USE_OPENAI=true)
 *
 * Key invariants:
 *   - creditsConsumed: 1 per successful classification (billing invariant from §2.4)
 *   - Null from classifyThread → skipped=true (AI unavailable, not a step failure)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { InboxAiService } from '../../ai-agent-gateway/inbox-ai.service';
import { ExternalEmailMessage } from '../../email-integration/entities/external-email-message.entity';

@Injectable()
export class AiClassifyActionHandler implements ActionHandler {
  readonly actionType = 'ai.classify' as const;

  constructor(
    private readonly inboxAiService: InboxAiService,
    @InjectRepository(ExternalEmailMessage)
    private readonly messageRepo: Repository<ExternalEmailMessage>,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'ai.classify') return { skipped: true };

    const event = ctx.triggerEvent as Record<string, unknown>;
    const threadId = (event['threadId'] ?? event['messageId']) as string | undefined;
    if (!threadId) return { skipped: true };

    const messages = await this.messageRepo.find({
      where: [
        { userId: ctx.userId, threadId },
        { userId: ctx.userId, externalMessageId: threadId },
      ],
      order: { internalDate: 'DESC' },
      take: 5,
    });

    if (!messages.length) return { skipped: true };

    const result = await this.inboxAiService.classifyThread(messages).catch(() => null);
    if (!result) return { skipped: true };

    return {
      data: {
        classification: result.label,
        confidence: result.confidence,
        message: result.message,
      },
      creditsConsumed: 1,
    };
  }
}
