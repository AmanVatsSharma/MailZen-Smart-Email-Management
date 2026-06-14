/**
 * File:        apps/backend/src/core/application/use-cases/messaging/create-template/create-template.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for CreateTemplateHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { CreateTemplateHandler } from './create-template.handler';
import { InMemoryEmailTemplateRepository } from '../../../../../testing/in-memory-email-template.repository';

describe('CreateTemplateHandler', () => {
  it('creates a template', async () => {
    const templates = new InMemoryEmailTemplateRepository();
    const handler = new CreateTemplateHandler(templates);

    const result = await handler.execute({
      ownerUserId: '22222222-2222-4222-8222-222222222222',
      name: 'Welcome',
      subject: 'Hi {{name}}',
      body: 'Welcome to {{product}}',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Welcome');
  });

  it('rejects a template with empty name', async () => {
    const handler = new CreateTemplateHandler(new InMemoryEmailTemplateRepository());
    const result = await handler.execute({
      ownerUserId: '22222222-2222-4222-8222-222222222222',
      name: '   ',
      subject: 's', body: 'b',
    });
    expect(result.ok).toBe(false);
  });
});
