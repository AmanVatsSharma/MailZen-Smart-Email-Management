/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-filters/list-filters.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for ListFiltersHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { ListFiltersHandler } from './list-filters.handler';
import { InMemoryEmailFilterRepository } from '../../../../../testing/in-memory-email-filter.repository';
import { UserId } from '../../../../../domain/shared/value-objects/ids';

describe('ListFiltersHandler', () => {
  it('returns all filters owned by a user', async () => {
    const filters = new InMemoryEmailFilterRepository();
    await filters.save({
      id: 'f1', ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
      name: 'A', rules: [{ field: 'subject', condition: 'CONTAINS', value: 'a', action: 'MARK_READ' }],
      createdAt: new Date(), updatedAt: new Date(),
    });
    const handler = new ListFiltersHandler(filters);

    const result = await handler.execute({ ownerUserId: '22222222-2222-4222-8222-222222222222' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
  });

  it('returns an empty list when no filters exist', async () => {
    const handler = new ListFiltersHandler(new InMemoryEmailFilterRepository());
    const result = await handler.execute({ ownerUserId: '22222222-2222-4222-8222-222222222222' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(0);
  });
});
