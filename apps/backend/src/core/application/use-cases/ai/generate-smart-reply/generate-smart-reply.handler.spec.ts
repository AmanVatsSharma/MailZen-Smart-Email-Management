/**
 * File:        apps/backend/src/core/application/use-cases/ai/generate-smart-reply/generate-smart-reply.handler.spec.ts
 * Module:      AI · Use Case · Test
 * Purpose:     Unit tests for GenerateSmartReplyHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { GenerateSmartReplyHandler } from './generate-smart-reply.handler';
import { InMemorySmartReplyRepository } from '../../../../testing/in-memory-smart-reply.repository';
import { FakeAiGateway } from '../../../../testing/fake-ai.gateway';

describe('GenerateSmartReplyHandler', () => {
  let handler: GenerateSmartReplyHandler;
  let replyRepo: InMemorySmartReplyRepository;
  let ai: FakeAiGateway;

  beforeEach(() => {
    replyRepo = new InMemorySmartReplyRepository();
    ai = new FakeAiGateway();
    handler = new GenerateSmartReplyHandler(replyRepo, ai);
    ai.setNextReplySuggestions([
      { text: 'Thanks!', score: 95 },
      { text: 'Sounds good.', score: 80 },
    ]);
  });

  it('returns a SmartReplyId with suggestions', async () => {
    const result = await handler.execute({
      emailId: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      tone: 'professional',
      email: { id: 'e-1', externalId: 'ext-1', subject: 's', from: 'f', date: new Date(), body: 'b' },
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.suggestions.length).toBe(2);
    }
  });

  it('returns ValidationError when AI returns no suggestions', async () => {
    ai.setNextReplySuggestions([]);
    const result = await handler.execute({
      emailId: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      email: { id: 'e-1', externalId: 'ext-1', subject: 's', from: 'f', date: new Date(), body: 'b' },
    });
    expect(result.isErr()).toBe(true);
  });
});
