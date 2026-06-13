/**
 * File:        apps/backend/src/core/application/use-cases/ai/accept-smart-reply/accept-smart-reply.handler.spec.ts
 * Module:      AI · Use Case · Test
 * Purpose:     Unit tests for AcceptSmartReplyHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AcceptSmartReplyHandler } from './accept-smart-reply.handler';
import { InMemorySmartReplyRepository } from '../../../../testing/in-memory-smart-reply.repository';
import { SmartReply } from '../../../../domain/bounded-contexts/ai/smart-reply.aggregate';

describe('AcceptSmartReplyHandler', () => {
  let handler: AcceptSmartReplyHandler;
  let repo: InMemorySmartReplyRepository;

  beforeEach(async () => {
    repo = new InMemorySmartReplyRepository();
    handler = new AcceptSmartReplyHandler(repo);
    const reply = SmartReply.create({
      id: 'r-1',
      emailId: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      suggestions: [
        { text: 'a', score: 80 },
        { text: 'b', score: 70 },
      ],
    });
    await repo.save(reply);
  });

  it('accepts a valid suggestion', async () => {
    const result = await handler.execute({
      smartReplyId: 'r-1',
      userId: 'u-1',
      suggestionIndex: 1,
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.acceptedIndex).toBe(1);
    }
  });

  it('rejects an out-of-range index', async () => {
    const result = await handler.execute({
      smartReplyId: 'r-1',
      userId: 'u-1',
      suggestionIndex: 99,
    });
    expect(result.isErr()).toBe(true);
  });
});
