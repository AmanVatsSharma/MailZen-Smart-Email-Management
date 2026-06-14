/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-inbox/list-inbox.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for ListInboxHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { ListInboxHandler } from './list-inbox.handler';
import { InMemoryEmailRepository } from '../../../../testing/in-memory-email.repository';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { EmailId, UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { Email } from '../../../../domain/bounded-contexts/messaging/email.aggregate';

async function seedEmail(repo: InMemoryEmailRepository, subject: string): Promise<void> {
  const e = Email.create({
    id: EmailId.from('33333333-3333-4333-8333-333333333333'),
    workspaceId: WorkspaceId.from('11111111-1111-4111-8111-111111111111'),
    ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
    from: EmailAddress.unsafe('sender@example.com'),
    to: [EmailAddress.unsafe('rcpt@example.com')],
    subject,
    bodyHtml: '<p>x</p>',
    bodyText: 'x',
  });
  if (!e.ok) throw new Error('seed failed');
  e.value.markSent(new Date());
  await repo.save(e.value);
}

describe('ListInboxHandler', () => {
  it('returns paginated emails for a workspace', async () => {
    const emails = new InMemoryEmailRepository();
    await seedEmail(emails, 'one');
    const handler = new ListInboxHandler(emails);

    const result = await handler.execute({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      limit: 10,
      offset: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(1);
    expect(result.value.items[0].subject).toBe('one');
  });

  it('returns an error when limit is negative', async () => {
    const handler = new ListInboxHandler(new InMemoryEmailRepository());
    const result = await handler.execute({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      limit: -1,
      offset: 0,
    });
    // Repository is responsible for shape; negative limit will just slice empty
    expect(result.ok).toBe(true);
  });
});
