/**
 * File:        core/application/ports/repositories/tracking-event.repository.ts
 * Module:      Application - Email Analytics Bounded Context
 * Purpose:     Port for tracking event persistence (open/click/bounce).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { TrackingEvent } from '../../../domain/bounded-contexts/email-analytics/tracking-event.aggregate';
import { Result } from '../../../domain/shared/result';

export const TRACKING_EVENT_REPOSITORY = Symbol('ITrackingEventRepository');

export interface ITrackingEventRepository {
  save(event: TrackingEvent): Promise<Result<void, Error>>;
  listForEmail(emailId: string): Promise<TrackingEvent[]>;
  countOpens(emailId: string): Promise<number>;
  countClicks(emailId: string): Promise<number>;
}
