/**
 * File:        apps/backend/src/core/application/use-cases/ai/list-triage-results/list-triage-results.handler.spec.ts
 * Module:      AI · Use Case · Test
 * Purpose:     Unit tests for ListTriageResultsHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListTriageResultsHandler } from './list-triage-results.handler';
import { InMemoryTriageResultRepository } from '../../../../testing/in-memory-triage-result.repository';
import { TriageResult, TriagePriority, TriageCategory } from '../../../../domain/bounded-contexts/ai/triage-result.aggregate';

describe('ListTriageResultsHandler', () => {
  let handler: ListTriageResultsHandler;
  let repo: InMemoryTriageResultRepository;

  beforeEach(async () => {
    repo = new InMemoryTriageResultRepository();
    handler = new ListTriageResultsHandler(repo);
    await repo.save(TriageResult.create({
      id: 't-1', emailId: 'e-1', workspaceId: 'ws-1', userId: 'u-1',
      priority: TriagePriority.HIGH, category: TriageCategory.WORK,
      reasoning: 'urgent', suggestedActions: [],
    }));
    await repo.save(TriageResult.create({
      id: 't-2', emailId: 'e-2', workspaceId: 'ws-1', userId: 'u-1',
      priority: TriagePriority.LOW, category: TriageCategory.NEWSLETTER,
      reasoning: 'low value', suggestedActions: [],
    }));
  });

  it('returns triage results for the user', async () => {
    const result = await handler.execute({ userId: 'u-1' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.total).toBe(2);
    }
  });

  it('filters by priority', async () => {
    const result = await handler.execute({
      userId: 'u-1',
      filters: { priority: TriagePriority.HIGH },
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.total).toBe(1);
      expect(result.value.results[0].priority).toBe(TriagePriority.HIGH);
    }
  });
});
