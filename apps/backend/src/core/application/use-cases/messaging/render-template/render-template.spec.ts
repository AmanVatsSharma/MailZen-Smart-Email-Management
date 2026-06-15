/**
 * File:        apps/backend/src/core/application/use-cases/messaging/render-template/render-template.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for RenderTemplateHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { RenderTemplateHandler } from './render-template.handler';
import { InMemoryEmailTemplateRepository } from '../../../../testing/in-memory-email-template.repository';
import { EmailTemplate } from '../../../../domain/bounded-contexts/messaging/email-template.aggregate';
import { UserId } from '../../../../domain/shared/value-objects/ids';

describe('RenderTemplateHandler', () => {
  it('interpolates variables', async () => {
    const templates = new InMemoryEmailTemplateRepository();
    const t = EmailTemplate.create({
      id: 't1', ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
      name: 'Welcome', subject: 'Hi {{name}}', body: 'Welcome to {{product}}!',
    });
    if (!t.ok) throw new Error('seed');
    await templates.save(t.value);
    const handler = new RenderTemplateHandler(templates);

    const result = await handler.execute({ templateId: 't1', variables: { name: 'Aman', product: 'MailZen' } });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subject).toBe('Hi Aman');
    expect(result.value.body).toBe('Welcome to MailZen!');
  });

  it('returns NotFoundError when template is missing', async () => {
    const handler = new RenderTemplateHandler(new InMemoryEmailTemplateRepository());
    const result = await handler.execute({ templateId: 'nope', variables: {} });
    expect(result.ok).toBe(false);
  });
});
