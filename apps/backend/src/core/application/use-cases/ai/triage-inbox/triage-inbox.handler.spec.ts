/**
 * File:        apps/backend/src/core/application/use-cases/ai/triage-inbox/triage-inbox.handler.spec.ts
 * Module:      AI · Use Case · Test
 * Purpose:     Unit tests for TriageInboxHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { TriageInboxHandler } from './triage-inbox.handler';
import { InMemoryTriageResultRepository } from '../../../../testing/in-memory-triage-result.repository';
import { FakeAiGateway } from '../../../../testing/fake-ai.gateway';
import { TriagePriority, TriageCategory } from '../../../../domain/bounded-contexts/ai/triage-result.aggregate';

describe('TriageInboxHandler', () => {
  let handler: TriageInboxHandler;
  let repo: InMemoryTriageResultRepository;
  let ai: FakeAiGateway;

  beforeEach(() => {
    repo = new InMemoryTriageResultRepository();
    ai = new FakeAiGateway();
    handler = new TriageInboxHandler(repo, ai);

    ai.setNextTriage({
      priority: TriagePriority.HIGH,
      category: TriageCategory.WORK,
      reasoning: 'urgent work request',
      suggestedActions: [{ type: 'archive', description: 'archive after response' }],
    });
  });

  it('creates a triage result for an email', async () => {
    const result = await handler.execute({
      emailId: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      email: { id: 'e-1', externalId: 'ext-1', subject: 's', from: 'f', date: new Date(), body: 'b' },
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.priority).toBe(TriagePriority.HIGH);
      expect(result.value.category).toBe(TriageCategory.WORK);
    }
  });
});
