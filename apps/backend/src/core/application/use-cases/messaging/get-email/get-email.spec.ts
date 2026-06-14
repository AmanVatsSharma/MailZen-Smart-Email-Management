/**
 * File:        apps/backend/src/core/application/use-cases/messaging/get-email/get-email.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for GetEmailHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { GetEmailHandler } from './get-email.handler';
import { InMemoryEmailRepository } from '../../../../testing/in-memory-email.repository';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { EmailId, UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { Email } from '../../../../domain/bounded-contexts/messaging/email.aggregate';

describe('GetEmailHandler', () => {
  it('returns the email when in workspace', async () => {
    const emails = new InMemoryEmailRepository();
    const e = Email.create({
      id: EmailId.from('33333333-3333-4333-8333-333333333333'),
      workspaceId: WorkspaceId.from('11111111-1111-4111-8111-111111111111'),
      ownerUserId: UserId.from('22222222-2222-4222-8222-222222222222'),
      from: EmailAddress.unsafe('sender@example.com'),
      to: [EmailAddress.unsafe('rcpt@example.com')],
      subject: 'hello',
      bodyHtml: '<p>x</p>',
      bodyText: 'x',
    });
    if (!e.ok) throw new Error('seed');
    await emails.save(e.value);
    const handler = new GetEmailHandler(emails);

    const result = await handler.execute({
      id: '33333333-3333-4333-8333-333333333333',
      workspaceId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subject).toBe('hello');
  });

  it('returns NotFoundError when the email does not exist', async () => {
    const handler = new GetEmailHandler(new InMemoryEmailRepository());
    const result = await handler.execute({
      id: '33333333-3333-4333-8333-333333333333',
      workspaceId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.ok).toBe(false);
  });
});
