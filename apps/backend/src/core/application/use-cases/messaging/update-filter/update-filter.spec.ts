/**
 * File:        apps/backend/src/core/application/use-cases/messaging/update-filter/update-filter.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for UpdateFilterHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { UpdateFilterHandler } from './update-filter.handler';
import { InMemoryEmailFilterRepository } from '../../../../testing/in-memory-email-filter.repository';
import { UserId } from '../../../../domain/shared/value-objects/ids';

describe('UpdateFilterHandler', () => {
  it('updates the name of an owned filter', async () => {
    const filters = new InMemoryEmailFilterRepository();
    await filters.save({
      id: 'f1', ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
      name: 'Old', rules: [{ field: 'subject', condition: 'CONTAINS', value: 'x', action: 'MARK_READ' }],
      createdAt: new Date(), updatedAt: new Date(),
    });
    const handler = new UpdateFilterHandler(filters);

    const result = await handler.execute({
      id: 'f1', ownerUserId: '22222222-2222-4222-8222-222222222222', name: 'New',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('New');
  });

  it('returns NotFoundError when filter does not exist', async () => {
    const handler = new UpdateFilterHandler(new InMemoryEmailFilterRepository());
    const result = await handler.execute({
      id: 'nope', ownerUserId: '22222222-2222-4222-8222-222222222222', name: 'x',
    });
    expect(result.ok).toBe(false);
  });
});
