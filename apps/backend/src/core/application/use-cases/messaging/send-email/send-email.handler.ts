/**
 * File:        apps/backend/src/core/application/use-cases/messaging/send-email/send-email.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     SendEmail use case. Validates recipients, persists the
 *              Email aggregate, dispatches through IMailGateway, and emits
 *              EmailSentEvent after successful persistence.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { randomUUID } from 'crypto';
import { IEmailRepository, EMAIL_REPOSITORY } from '../../../ports/repositories/email.repository';
import { IMailGateway, MAIL_GATEWAY, OutgoingMail } from '../../../ports/gateways/mail.gateway';
import { IEventBus, EVENT_BUS } from '../../../ports/event-bus/event-bus';
import { IUnitOfWork, UNIT_OF_WORK } from '../../../ports/persistence/unit-of-work';
import { Email, EmailSentEvent } from '../../../../domain/bounded-contexts/messaging/email.aggregate';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { EmailId, UserId, WorkspaceId, ThreadId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ValidationError } from '../../../exceptions/application-error';
import { SendEmailInput, SendEmailOutput } from './send-email.dto';

export const SEND_EMAIL_HANDLER = Symbol('SendEmailHandler');

export class SendEmailHandler {
  constructor(
    private readonly emails: IEmailRepository,
    private readonly mailer: IMailGateway,
    private readonly bus: IEventBus,
    private readonly uow: IUnitOfWork,
  ) {}

  async execute(input: SendEmailInput): Promise<Result<SendEmailOutput, Error>> {
    const fromResult = EmailAddress.create(input.from);
    if (!fromResult.ok) return makeResult(Result.err(new ValidationError('from is invalid', 'from')));
    const from = fromResult.value;

    const toAddrs: EmailAddress[] = [];
    for (const r of input.to) {
      const r2 = EmailAddress.create(r);
      if (!r2.ok) return makeResult(Result.err(new ValidationError(`recipient ${r} invalid`, 'to')));
      toAddrs.push(r2.value);
    }
    if (toAddrs.length === 0) {
      return makeResult(Result.err(new ValidationError('at least one recipient required', 'to')));
    }

    const ccAddrs: EmailAddress[] = [];
    for (const c of input.cc ?? []) {
      const c2 = EmailAddress.create(c);
      if (c2.ok) ccAddrs.push(c2.value);
    }
    const bccAddrs: EmailAddress[] = [];
    for (const b of input.bcc ?? []) {
      const b2 = EmailAddress.create(b);
      if (b2.ok) bccAddrs.push(b2.value);
    }

    const id = EmailId.from(randomUUID());
    const created = Email.create({
      id,
      workspaceId: WorkspaceId.from(input.workspaceId),
      ownerUserId: UserId.from(input.ownerUserId),
      from,
      to: toAddrs,
      cc: ccAddrs,
      bcc: bccAddrs,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      threadId: input.threadId ? ThreadId.from(input.threadId) : null,
    });
    if (!created.ok) return makeResult(Result.err(new ValidationError(created.error.message)));
    const email = created.value;
    email.markSending();

    const sendResult = await this.uow.transaction(async () => {
      await this.emails.save(email);
      const mail: OutgoingMail = {
        from: input.from,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
      };
      const r = await this.mailer.send(mail);
      if (!r.ok) {
        email.markFailed(r.error.message);
        await this.emails.save(email);
        return r;
      }
      email.markSent(new Date());
      await this.emails.save(email);
      return r;
    });
    if (!sendResult.ok) return makeResult(Result.err(sendResult.error));

    await this.bus.publishAll(email.pullDomainEvents());
    return makeResult(Result.ok({
      id: email.id,
      status: email.status,
      providerMessageId: sendResult.value.providerMessageId,
    }));
  }
}
