/**
 * File:        apps/backend/src/core/application/use-cases/messaging/create-filter/create-filter.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for CreateFilterHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { CreateFilterHandler } from './create-filter.handler';
import { InMemoryEmailFilterRepository } from '../../../../../testing/in-memory-email-filter.repository';

describe('CreateFilterHandler', () => {
  it('creates a filter with one rule', async () => {
    const filters = new InMemoryEmailFilterRepository();
    const handler = new CreateFilterHandler(filters);

    const result = await handler.execute({
      ownerUserId: '22222222-2222-4222-8222-222222222222',
      name: 'Promotions',
      rules: [{ field: 'subject', condition: 'CONTAINS', value: 'sale', action: 'MARK_IMPORTANT' }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ruleCount).toBe(1);
  });

  it('rejects filters with no rules', async () => {
    const handler = new CreateFilterHandler(new InMemoryEmailFilterRepository());
    const result = await handler.execute({
      ownerUserId: '22222222-2222-4222-8222-222222222222',
      name: 'Empty',
      rules: [],
    });
    expect(result.ok).toBe(false);
  });
});
