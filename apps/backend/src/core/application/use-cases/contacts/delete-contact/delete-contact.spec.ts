/**
 * File:        apps/backend/src/core/application/use-cases/contacts/delete-contact/delete-contact.spec.ts
 * Module:      Contacts Use Cases
 * Purpose:     Tests for DeleteContact use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { DeleteContactHandler } from './delete-contact.handler';
import { DeleteContactCommand } from './delete-contact.command';
import { InMemoryContactRepository } from '../../../../testing/in-memory-contact.repository';

describe('DeleteContactHandler', () => {
  let handler: DeleteContactHandler;
  let contactRepo: InMemoryContactRepository;

  beforeEach(() => {
    contactRepo = new InMemoryContactRepository();
    handler = new DeleteContactHandler(contactRepo as any);
  });

  it('should fail when contact not found', async () => {
    const result = await handler.execute(new DeleteContactCommand({ contactId: 'nope' }));
    expect(result.isErr()).toBe(true);
  });
});
