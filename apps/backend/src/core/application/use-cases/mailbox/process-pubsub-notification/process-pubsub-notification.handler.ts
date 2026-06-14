/**
 * File:        apps/backend/src/core/application/use-cases/mailbox/process-pubsub-notification/process-pubsub-notification.handler.ts
 * Module:      Mailbox · Use Case
 * Purpose:     Handle Gmail Pub/Sub webhook. Triggers sync for the
 *              mailbox associated with the subscription.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { MAILBOX_REPOSITORY, IMailboxRepository } from '../../../ports/repositories/mailbox.repository';
import { PUBSUB_GATEWAY, IPubSubGateway } from '../../../ports/gateways/pubsub.gateway';
import { NotFoundError } from '../../../exceptions/application-error';

export interface PubSubNotification {
  messageId: string;
  subscriptionId: string;
  data: Buffer;
  attributes: {
    expiration: string;
    data: string;
    messageId: string;
  };
}

@Injectable()
export class ProcessPubSubNotificationHandler {
  constructor(
    @Inject(MAILBOX_REPOSITORY)
    private readonly mailboxRepo: IMailboxRepository,
    @Inject(PUBSUB_GATEWAY)
    private readonly pubsubGateway: IPubSubGateway,
  ) {}

  async execute(
    input: PubSubNotification,
  ): Promise<Result<void, NotFoundError>> {
    try {
      const { mailboxId, accessToken } = JSON.parse(input.data.toString());
      const mailbox = await this.mailboxRepo.findById(mailboxId);

      if (!mailbox) {
        return makeResult(Result.err(new NotFoundError('Mailbox')));
      }

      await this.pubsubGateway.publish('sync:triggered', Buffer.from(JSON.stringify({
        mailboxId: mailbox.id,
        userId: mailbox.userId,
        accessToken,
      })));

      return makeResult(Result.ok(undefined));
    } catch (e) {
      const result = makeResult(Result.err(new NotFoundError('Invalid notification payload')));
      console.error('Failed to process Pub/Sub notification:', e);
      return result;
    }
  }
}
