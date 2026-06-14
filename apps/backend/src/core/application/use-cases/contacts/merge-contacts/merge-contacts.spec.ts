/**
 * File:        apps/backend/src/core/application/use-cases/contacts/merge-contacts/merge-contacts.spec.ts
 * Module:      Contacts Use Cases
 * Purpose:     Tests for MergeContacts use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { MergeContactsHandler } from './merge-contacts.handler';
import { MergeContactsCommand } from './merge-contacts.command';
import { InMemoryContactRepository } from '../../../../testing/in-memory-contact.repository';

describe('MergeContactsHandler', () => {
  let handler: MergeContactsHandler;
  let contactRepo: InMemoryContactRepository;

  beforeEach(() => {
    contactRepo = new InMemoryContactRepository();
    handler = new MergeContactsHandler(contactRepo as any);
  });

  it('should fail when same id given twice', async () => {
    const result = await handler.execute(new MergeContactsCommand({
      primaryContactId: 'c-1',
      duplicateContactId: 'c-1',
    }));
    expect(result.isErr()).toBe(true);
  });

  it('should fail when contact not found', async () => {
    const result = await handler.execute(new MergeContactsCommand({
      primaryContactId: 'nope',
      duplicateContactId: 'nope2',
    }));
    expect(result.isErr()).toBe(true);
  });
});
