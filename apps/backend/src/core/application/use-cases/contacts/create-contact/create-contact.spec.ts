/**
 * File:        apps/backend/src/core/application/use-cases/contacts/create-contact/create-contact.spec.ts
 * Module:      Contacts Use Cases
 * Purpose:     Tests for CreateContact use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { CreateContactHandler } from './create-contact.handler';
import { CreateContactCommand } from './create-contact.command';
import { InMemoryContactRepository } from '../../../../testing/in-memory-contact.repository';

describe('CreateContactHandler', () => {
  let handler: CreateContactHandler;
  let contactRepo: InMemoryContactRepository;

  beforeEach(() => {
    contactRepo = new InMemoryContactRepository();
    handler = new CreateContactHandler(contactRepo as any);
  });

  it('should create a contact', async () => {
    const result = await handler.execute(new CreateContactCommand({
      workspaceId: 'ws-1',
      email: 'a@b.com',
      displayName: 'Alice',
    }));
    expect(result.isOk()).toBe(true);
  });

  it('should fail when input missing', async () => {
    const result = await handler.execute(new CreateContactCommand({
      workspaceId: 'ws-1',
      email: '',
      displayName: 'X',
    }));
    expect(result.isErr()).toBe(true);
  });
});
