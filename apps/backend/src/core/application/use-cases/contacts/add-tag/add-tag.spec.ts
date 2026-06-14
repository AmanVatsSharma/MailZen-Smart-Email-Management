/**
 * File:        apps/backend/src/core/application/use-cases/contacts/add-tag/add-tag.spec.ts
 * Module:      Contacts Use Cases
 * Purpose:     Tests for AddTag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AddTagHandler } from './add-tag.handler';
import { AddTagCommand } from './add-tag.command';
import { InMemoryContactRepository } from '../../../../testing/in-memory-contact.repository';

describe('AddTagHandler', () => {
  let handler: AddTagHandler;
  let contactRepo: InMemoryContactRepository;

  beforeEach(() => {
    contactRepo = new InMemoryContactRepository();
    handler = new AddTagHandler(contactRepo as any);
  });

  it('should fail when contact not found', async () => {
    const result = await handler.execute(new AddTagCommand({ contactId: 'nope', tag: 'vip' }));
    expect(result.isErr()).toBe(true);
  });
});
