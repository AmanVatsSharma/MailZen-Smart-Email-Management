/**
 * File:        apps/backend/src/core/application/use-cases/messaging/send-email/send-email.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for SendEmailHandler. Covers success path and validation
 *              error path against in-memory fakes.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { SendEmailHandler } from './send-email.handler';
import { InMemoryEmailRepository } from '../../../../testing/in-memory-email.repository';
import { FakeMailGateway } from '../../../../testing/fake-mail.gateway';
import { FakeEventBus } from '../../../../testing/fake-event-bus';
import { FakeUnitOfWork } from '../../../../testing/fake-unit-of-work';
import { EmailId } from '../../../../domain/shared/value-objects/ids';
import { EmailStatus } from '../../../../domain/bounded-contexts/messaging/email.aggregate';

const validInput = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  ownerUserId: '22222222-2222-4222-8222-222222222222',
  from: 'sender@example.com',
  to: ['recipient@example.com'],
  subject: 'Hello',
  bodyHtml: '<p>hi</p>',
  bodyText: 'hi',
};

describe('SendEmailHandler', () => {
  it('sends mail, persists email, and emits EmailSentEvent', async () => {
    const emails = new InMemoryEmailRepository();
    const mailer = new FakeMailGateway();
    const bus = new FakeEventBus();
    const uow = new FakeUnitOfWork();
    const handler = new SendEmailHandler(emails, mailer, bus, uow);

    const result = await handler.execute(validInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe(EmailStatus.Sent);
    expect(mailer.sent).toHaveLength(1);
    expect(bus.events.some((e) => e.type === 'messaging.email.sent')).toBe(true);
    const persisted = await emails.findById(EmailId.from(result.value.id));
    expect(persisted).not.toBeNull();
  });

  it('returns a validation error for an empty recipient list', async () => {
    const handler = new SendEmailHandler(
      new InMemoryEmailRepository(),
      new FakeMailGateway(),
      new FakeEventBus(),
      new FakeUnitOfWork(),
    );

    const result = await handler.execute({ ...validInput, to: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('recipient');
  });

  it('returns a validation error for an invalid sender address', async () => {
    const handler = new SendEmailHandler(
      new InMemoryEmailRepository(),
      new FakeMailGateway(),
      new FakeEventBus(),
      new FakeUnitOfWork(),
    );

    const result = await handler.execute({ ...validInput, from: 'not-an-email' });

    expect(result.ok).toBe(false);
  });
});
