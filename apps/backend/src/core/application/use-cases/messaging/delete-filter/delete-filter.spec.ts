/**
 * File:        apps/backend/src/core/application/use-cases/messaging/delete-filter/delete-filter.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for DeleteFilterHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { DeleteFilterHandler } from './delete-filter.handler';
import { InMemoryEmailFilterRepository } from '../../../../../testing/in-memory-email-filter.repository';
import { UserId } from '../../../../../domain/shared/value-objects/ids';

describe('DeleteFilterHandler', () => {
  it('removes an owned filter', async () => {
    const filters = new InMemoryEmailFilterRepository();
    await filters.save({
      id: 'f1', ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
      name: 'x', rules: [{ field: 'subject', condition: 'CONTAINS', value: 'a', action: 'MARK_READ' }],
      createdAt: new Date(), updatedAt: new Date(),
    });
    const handler = new DeleteFilterHandler(filters);
    const result = await handler.execute({
      id: 'f1', ownerUserId: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.ok).toBe(true);
    expect(await filters.findById('f1')).toBeNull();
  });

  it('succeeds idempotently when the filter does not exist', async () => {
    const handler = new DeleteFilterHandler(new InMemoryEmailFilterRepository());
    const result = await handler.execute({
      id: 'nope', ownerUserId: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.ok).toBe(true);
  });
});
