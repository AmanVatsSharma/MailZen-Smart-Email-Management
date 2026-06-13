/**
 * File:        apps/backend/src/core/application/use-cases/ai/list-ai-usage/list-ai-usage.handler.spec.ts
 * Module:      AI · Use Case · Test
 * Purpose:     Unit tests for ListAiUsageHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListAiUsageHandler } from './list-ai-usage.handler';
import { InMemorySmartReplyRepository } from '../../../../testing/in-memory-smart-reply.repository';
import { InMemoryTriageResultRepository } from '../../../../testing/in-memory-triage-result.repository';
import { SmartReply } from '../../../../domain/bounded-contexts/ai/smart-reply.aggregate';
import { TriageResult, TriagePriority, TriageCategory } from '../../../../domain/bounded-contexts/ai/triage-result.aggregate';

describe('ListAiUsageHandler', () => {
  let handler: ListAiUsageHandler;
  let replies: InMemorySmartReplyRepository;
  let triage: InMemoryTriageResultRepository;

  beforeEach(async () => {
    replies = new InMemorySmartReplyRepository();
    triage = new InMemoryTriageResultRepository();
    handler = new ListAiUsageHandler(replies, triage);
    await replies.save(SmartReply.create({
      id: 'r-1', emailId: 'e-1', workspaceId: 'ws-1', userId: 'u-1', suggestions: [{ text: 'a', score: 80 }],
    }));
    await triage.save(TriageResult.create({
      id: 't-1', emailId: 'e-2', workspaceId: 'ws-1', userId: 'u-1',
      priority: TriagePriority.HIGH, category: TriageCategory.WORK,
      reasoning: 'urgent', suggestedActions: [],
    }));
  });

  it('reports total AI operations', async () => {
    const result = await handler.execute({ userId: 'u-1' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.consumedCredits).toBe(2);
    }
  });
});
