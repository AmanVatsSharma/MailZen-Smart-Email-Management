/**
 * File:        core/infrastructure/persistence/typeorm/mappers/email.mapper.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Anti-corruption layer. Translates ORM row <-> domain aggregate.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Email, EmailStatus } from '../../../../domain/bounded-contexts/messaging/email.aggregate';
import { EmailAddress } from '../../../../domain/shared/value-objects/email-address';
import { WorkspaceId, UserId, EmailId, ThreadId } from '../../../../domain/shared/value-objects/ids';
import { EmailOrmEntity } from '../entities/email.orm-entity';

export const EmailMapper = {
  toOrm(email: Email): EmailOrmEntity {
    const orm = new EmailOrmEntity();
    orm.id = email.props.id as unknown as string;
    orm.workspaceId = email.props.workspaceId.value;
    orm.authorId = email.props.ownerUserId.value;
    orm.fromAddress = { value: email.props.from.toString() };
    orm.toAddresses = email.props.to.map(a => ({ value: a.toString() }));
    orm.ccAddresses = email.props.cc.map(a => ({ value: a.toString() }));
    orm.bccAddresses = email.props.bcc.map(a => ({ value: a.toString() }));
    orm.subject = email.props.subject;
    orm.bodyHtml = email.props.bodyHtml;
    orm.bodyText = email.props.bodyText;
    orm.status = email.props.status;
    orm.scheduledAt = email.props.scheduledAt;
    orm.sentAt = email.props.sentAt;
    orm.threadId = email.props.threadId ? email.props.threadId.value : null;
    return orm;
  },

  toDomain(row: EmailOrmEntity): Email {
    return Email.rehydrate({
      id: EmailId.from(row.id),
      workspaceId: WorkspaceId.from(row.workspaceId),
      ownerUserId: UserId.from(row.authorId),
      from: EmailAddress.unsafe(row.fromAddress.value),
      to: (row.toAddresses ?? []).map(a => EmailAddress.unsafe(a.value)),
      cc: (row.ccAddresses ?? []).map(a => EmailAddress.unsafe(a.value)),
      bcc: (row.bccAddresses ?? []).map(a => EmailAddress.unsafe(a.value)),
      subject: row.subject,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      status: (row.status as unknown) as EmailStatus,
      threadId: row.threadId ? ThreadId.from(row.threadId) : null,
      scheduledAt: row.scheduledAt,
      sentAt: row.sentAt,
      failureReason: null,
      bounceReason: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },
};
