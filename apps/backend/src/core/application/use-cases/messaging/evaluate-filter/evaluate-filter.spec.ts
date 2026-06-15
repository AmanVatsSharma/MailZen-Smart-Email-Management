/**
 * File:        apps/backend/src/core/application/use-cases/messaging/evaluate-filter/evaluate-filter.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for EvaluateFilterHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EvaluateFilterHandler } from './evaluate-filter.handler';
import { InMemoryEmailFilterRepository } from '../../../../testing/in-memory-email-filter.repository';
import { InMemoryEmailRepository } from '../../../../testing/in-memory-email.repository';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { EmailId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { Email } from '../../../../domain/bounded-contexts/messaging/email.aggregate';

async function seedEmail(): Promise<string> {
  const repo = new InMemoryEmailRepository();
  const e = Email.create({
    id: EmailId.from('33333333-3333-4333-8333-333333333333'),
    workspaceId: WorkspaceId.from('11111111-1111-4111-8111-111111111111'),
    ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
    from: EmailAddress.unsafe('sender@example.com'),
    to: [EmailAddress.unsafe('rcpt@example.com')],
    subject: 'Big Sale Today',
    bodyHtml: '<p>x</p>',
    bodyText: 'x',
  });
  if (!e.ok) throw new Error('seed');
  await repo.save(e.value);
  return '33333333-3333-4333-8333-333333333333';
}

describe('EvaluateFilterHandler', () => {
  it('returns matches=true and the action when the rule fires', async () => {
    const filters = new InMemoryEmailFilterRepository();
    const emails = new InMemoryEmailRepository();
    const emailId = await seedEmail();
    await filters.save({
      id: 'f1',
      ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
      name: 'Promo',
      rules: [{ field: 'subject', condition: 'CONTAINS', value: 'sale', action: 'MARK_IMPORTANT' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = new EvaluateFilterHandler(filters, emails);
    const result = await handler.execute({ filterId: 'f1', emailId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matches).toBe(true);
    expect(result.value.action).toBe('MARK_IMPORTANT');
  });

  it('returns matches=false when the rule does not fire', async () => {
    const filters = new InMemoryEmailFilterRepository();
    const emails = new InMemoryEmailRepository();
    const emailId = await seedEmail();
    await filters.save({
      id: 'f1',
      ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
      name: 'Newsletter',
      rules: [{ field: 'subject', condition: 'CONTAINS', value: 'newsletter', action: 'MARK_READ' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const handler = new EvaluateFilterHandler(filters, emails);
    const result = await handler.execute({ filterId: 'f1', emailId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.matches).toBe(false);
  });
});
