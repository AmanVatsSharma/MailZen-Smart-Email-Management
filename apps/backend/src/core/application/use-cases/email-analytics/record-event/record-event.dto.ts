/**
 * File:        apps/backend/src/core/application/use-cases/email-analytics/record-event/record-event.dto.ts
 * Module:      Email Analytics Use Cases
 * Purpose:     Data transfer object for RecordEvent use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { TrackingKind } from '../../../../domain/bounded-contexts/email-analytics/tracking-event.aggregate';

export interface RecordEventDto {
  emailId: string;
  recipientEmail: string;
  kind: TrackingKind;
  linkUrl?: string;
  userAgent?: string;
  ipAddress?: string;
}
