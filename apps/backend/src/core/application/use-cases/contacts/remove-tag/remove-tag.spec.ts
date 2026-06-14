/**
 * File:        apps/backend/src/core/application/use-cases/contacts/remove-tag/remove-tag.spec.ts
 * Module:      Contacts Use Cases
 * Purpose:     Tests for RemoveTag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RemoveTagHandler } from './remove-tag.handler';
import { RemoveTagCommand } from './remove-tag.command';
import { InMemoryContactRepository } from '../../../../testing/in-memory-contact.repository';

describe('RemoveTagHandler', () => {
  let handler: RemoveTagHandler;
  let contactRepo: InMemoryContactRepository;

  beforeEach(() => {
    contactRepo = new InMemoryContactRepository();
    handler = new RemoveTagHandler(contactRepo as any);
  });

  it('should fail when contact not found', async () => {
    const result = await handler.execute(new RemoveTagCommand({ contactId: 'nope', tag: 'vip' }));
    expect(result.isErr()).toBe(true);
  });
});
