/**
 * File:        apps/backend/src/core/application/use-cases/messaging/schedule-email/schedule-email.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for ScheduleEmailHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { ScheduleEmailHandler } from './schedule-email.handler';
import { InMemoryEmailRepository } from '../../../../testing/in-memory-email.repository';
import { EmailId } from '../../../../domain/shared/value-objects/ids';
import { EmailStatus } from '../../../../domain/bounded-contexts/messaging/email.aggregate';

const future = new Date(Date.now() + 60_000);

describe('ScheduleEmailHandler', () => {
  it('schedules an email for a future time and persists it', async () => {
    const emails = new InMemoryEmailRepository();
    const handler = new ScheduleEmailHandler(emails);

    const result = await handler.execute({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      ownerUserId: '22222222-2222-4222-8222-222222222222',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      subject: 'Reminder',
      bodyHtml: '<p>reminder</p>',
      bodyText: 'reminder',
      scheduledAt: future,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe(EmailStatus.Scheduled);
    const persisted = await emails.findById(EmailId.from(result.value.id));
    expect(persisted).not.toBeNull();
  });

  it('returns a validation error when scheduledAt is in the past', async () => {
    const handler = new ScheduleEmailHandler(new InMemoryEmailRepository());

    const result = await handler.execute({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      ownerUserId: '22222222-2222-4222-8222-222222222222',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      subject: 'Past',
      bodyHtml: '<p>x</p>',
      bodyText: 'x',
      scheduledAt: new Date(Date.now() - 60_000),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('future');
  });
});
