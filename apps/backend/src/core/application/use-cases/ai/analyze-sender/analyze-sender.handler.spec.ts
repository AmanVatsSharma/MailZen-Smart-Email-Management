/**
 * File:        apps/backend/src/core/application/use-cases/ai/analyze-sender/analyze-sender.handler.spec.ts
 * Module:      AI · Use Case · Test
 * Purpose:     Unit tests for AnalyzeSenderHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AnalyzeSenderHandler } from './analyze-sender.handler';
import { InMemorySenderProfileRepository } from '../../../../testing/in-memory-sender-profile.repository';
import { FakeAiGateway } from '../../../../testing/fake-ai.gateway';

describe('AnalyzeSenderHandler', () => {
  let handler: AnalyzeSenderHandler;
  let repo: InMemorySenderProfileRepository;
  let ai: FakeAiGateway;

  beforeEach(() => {
    repo = new InMemorySenderProfileRepository();
    ai = new FakeAiGateway();
    handler = new AnalyzeSenderHandler(repo, ai);
    ai.setNextAnalysis({
      emailAddress: 'a@b.com',
      totalReceived: 10,
      totalReplied: 7,
      averageReplyTimeMs: 60_000,
      openRate: 0.8,
      clickRate: 0.5,
      trustScore: 0.85,
    });
  });

  it('creates a new sender profile with computed metrics', async () => {
    const result = await handler.execute({
      senderEmail: 'a@b.com',
      workspaceId: 'ws-1',
      userId: 'u-1',
      history: { totalReceived: 5, totalReplied: 1, averageReplyTimeMs: 120_000, openRate: 0.4, clickRate: 0.1 },
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.trustScore).toBe(0.85);
      expect(result.value.totalReceived).toBe(10);
    }
  });
});
