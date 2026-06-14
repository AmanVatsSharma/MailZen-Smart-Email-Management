/**
 * File:        apps/backend/src/core/application/use-cases/email-analytics/record-event/record-event.handler.ts
 * Module:      Email Analytics Use Cases
 * Purpose:     Record a tracking event (open/click/bounce/unsubscribe) for a sent email
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { TRACKING_EVENT_REPOSITORY, ITrackingEventRepository } from '../../ports/repositories/tracking-event.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { TrackingEvent } from '../../../../domain/bounded-contexts/email-analytics/tracking-event.aggregate';
import { RecordEventCommand } from './record-event.command';

@Injectable()
export class RecordEventHandler {
  constructor(
    @Inject(TRACKING_EVENT_REPOSITORY)
    private trackingEventRepo: ITrackingEventRepository,
  ) {}

  async execute(command: RecordEventCommand): Promise<Result<TrackingEvent, ApplicationError>> {
    const recordResult = TrackingEvent.record({
      emailId: command.input.emailId,
      recipientEmail: command.input.recipientEmail,
      kind: command.input.kind,
      linkUrl: command.input.linkUrl,
      userAgent: command.input.userAgent,
      ipAddress: command.input.ipAddress,
    });

    if (recordResult.isErr()) {
      return Result.err(new ApplicationError('TRACKING_EVENT_CREATE_FAILED', recordResult.error.message));
    }

    const event = recordResult.value;
    const saveResult = await this.trackingEventRepo.save(event);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('TRACKING_EVENT_SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(event);
  }
}
