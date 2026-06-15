/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-templates/list-templates.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for ListTemplatesHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { ListTemplatesHandler } from './list-templates.handler';
import { InMemoryEmailTemplateRepository } from '../../../../testing/in-memory-email-template.repository';
import { EmailTemplate } from '../../../../domain/bounded-contexts/messaging/email-template.aggregate';
import { UserId } from '../../../../domain/shared/value-objects/ids';

describe('ListTemplatesHandler', () => {
  it('returns owned templates', async () => {
    const templates = new InMemoryEmailTemplateRepository();
    const t = EmailTemplate.create({
      id: 't1', ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
      name: 'Welcome', subject: 'Hi', body: 'Body',
    });
    if (!t.ok) throw new Error('seed');
    await templates.save(t.value);
    const handler = new ListTemplatesHandler(templates);

    const result = await handler.execute({ ownerUserId: '22222222-2222-4222-8222-222222222222' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
  });

  it('returns empty list when user has no templates', async () => {
    const handler = new ListTemplatesHandler(new InMemoryEmailTemplateRepository());
    const result = await handler.execute({ ownerUserId: '22222222-2222-4222-8222-222222222222' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(0);
  });
});
