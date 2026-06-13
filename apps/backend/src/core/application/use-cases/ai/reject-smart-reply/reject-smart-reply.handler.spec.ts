/**
 * File:        apps/backend/src/core/application/use-cases/ai/reject-smart-reply/reject-smart-reply.handler.spec.ts
 * Module:      AI · Use Case · Test
 * Purpose:     Unit tests for RejectSmartReplyHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RejectSmartReplyHandler } from './reject-smart-reply.handler';
import { InMemorySmartReplyRepository } from '../../../../testing/in-memory-smart-reply.repository';
import { SmartReply } from '../../../../domain/bounded-contexts/ai/smart-reply.aggregate';

describe('RejectSmartReplyHandler', () => {
  let handler: RejectSmartReplyHandler;
  let repo: InMemorySmartReplyRepository;

  beforeEach(async () => {
    repo = new InMemorySmartReplyRepository();
    handler = new RejectSmartReplyHandler(repo);
    await repo.save(SmartReply.create({
      id: 'r-1',
      emailId: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      suggestions: [{ text: 'a', score: 80 }],
    }));
  });

  it('rejects a suggestion', async () => {
    const result = await handler.execute({
      smartReplyId: 'r-1',
      userId: 'u-1',
      suggestionIndex: 0,
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.rejectedIndices).toContain(0);
    }
  });
});
