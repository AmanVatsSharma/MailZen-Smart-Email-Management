/**
 * File:        apps/backend/src/core/application/use-cases/messaging/schedule-email/schedule-email.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     ScheduleEmail use case. Validates the schedule is in the
 *              future, transitions the Email aggregate via Email.schedule,
 *              and persists the result.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { randomUUID } from 'crypto';
import { IEmailRepository, EMAIL_REPOSITORY } from '../../../ports/repositories/email.repository';
import { Email } from '../../../../domain/bounded-contexts/messaging/email.aggregate';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { EmailId, UserId, WorkspaceId, ThreadId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ValidationError } from '../../../exceptions/application-error';
import { ScheduleEmailInput, ScheduleEmailOutput } from './schedule-email.dto';

export const SCHEDULE_EMAIL_HANDLER = Symbol('ScheduleEmailHandler');

export class ScheduleEmailHandler {
  constructor(private readonly emails: IEmailRepository) {}

  async execute(input: ScheduleEmailInput): Promise<Result<ScheduleEmailOutput, Error>> {
    if (!(input.scheduledAt instanceof Date) || Number.isNaN(input.scheduledAt.getTime())) {
      return makeResult(Result.err(new ValidationError('scheduledAt is required', 'scheduledAt')));
    }
    if (input.scheduledAt.getTime() <= Date.now()) {
      return makeResult(Result.err(new ValidationError('scheduledAt must be in the future', 'scheduledAt')));
    }

    const from = EmailAddress.create(input.from);
    if (!from.ok) return makeResult(Result.err(new ValidationError('from is invalid', 'from')));
    const toAddrs: EmailAddress[] = [];
    for (const r of input.to) {
      const r2 = EmailAddress.create(r);
      if (!r2.ok) return makeResult(Result.err(new ValidationError(`recipient ${r} invalid`, 'to')));
      toAddrs.push(r2.value);
    }
    if (toAddrs.length === 0) {
      return makeResult(Result.err(new ValidationError('at least one recipient required', 'to')));
    }

    const created = Email.create({
      id: EmailId.from(randomUUID()),
      workspaceId: WorkspaceId.from(input.workspaceId),
      ownerUserId: UserId.from(input.ownerUserId),
      from: from.value,
      to: toAddrs,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      bodyText: input.bodyText,
      threadId: input.threadId ? ThreadId.from(input.threadId) : null,
    });
    if (!created.ok) return makeResult(Result.err(new ValidationError(created.error.message)));
    const email = created.value;
    const scheduled = email.schedule(input.scheduledAt);
    if (!scheduled.ok) return makeResult(Result.err(new ValidationError(scheduled.error.message, 'scheduledAt')));
    await this.emails.save(email);
    return makeResult(Result.ok({ id: email.id, status: email.status, scheduledAt: input.scheduledAt }));
  }
}
