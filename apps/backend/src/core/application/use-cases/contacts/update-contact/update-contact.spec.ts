/**
 * File:        apps/backend/src/core/application/use-cases/contacts/update-contact/update-contact.spec.ts
 * Module:      Contacts Use Cases
 * Purpose:     Tests for UpdateContact use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { UpdateContactHandler } from './update-contact.handler';
import { UpdateContactCommand } from './update-contact.command';
import { InMemoryContactRepository } from '../../../../testing/in-memory-contact.repository';

describe('UpdateContactHandler', () => {
  let handler: UpdateContactHandler;
  let contactRepo: InMemoryContactRepository;

  beforeEach(() => {
    contactRepo = new InMemoryContactRepository();
    handler = new UpdateContactHandler(contactRepo as any);
  });

  it('should fail when contact not found', async () => {
    const result = await handler.execute(new UpdateContactCommand({ contactId: 'nope', displayName: 'X' }));
    expect(result.isErr()).toBe(true);
  });
});
