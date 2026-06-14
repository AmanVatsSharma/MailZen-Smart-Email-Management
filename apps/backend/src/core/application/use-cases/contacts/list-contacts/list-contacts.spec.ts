/**
 * File:        apps/backend/src/core/application/use-cases/contacts/list-contacts/list-contacts.spec.ts
 * Module:      Contacts Use Cases
 * Purpose:     Tests for ListContacts use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListContactsHandler } from './list-contacts.handler';
import { ListContactsCommand } from './list-contacts.command';
import { InMemoryContactRepository } from '../../../../testing/in-memory-contact.repository';

describe('ListContactsHandler', () => {
  let handler: ListContactsHandler;
  let contactRepo: InMemoryContactRepository;

  beforeEach(() => {
    contactRepo = new InMemoryContactRepository();
    handler = new ListContactsHandler(contactRepo as any);
  });

  it('should return empty list for new workspace', async () => {
    const result = await handler.execute(new ListContactsCommand({ workspaceId: 'ws-1' }));
    expect(result.isOk()).toBe(true);
    expect(result.value?.total).toBe(0);
  });
});
