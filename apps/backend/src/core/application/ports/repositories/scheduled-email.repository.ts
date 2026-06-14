/**
 * File:        core/application/ports/repositories/scheduled-email.repository.ts
 * Module:      Application - Scheduled Email Bounded Context
 * Purpose:     Port for scheduled-send email persistence.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ScheduledEmail } from '../../../domain/bounded-contexts/scheduled-email/scheduled-email.aggregate';
import { Result } from '../../../domain/shared/result';

export const SCHEDULED_EMAIL_REPOSITORY = Symbol('IScheduledEmailRepository');

export interface IScheduledEmailRepository {
  save(scheduled: ScheduledEmail): Promise<Result<void, Error>>;
  findById(id: string): Promise<ScheduledEmail | null>;
  listDue(before: Date, limit: number): Promise<ScheduledEmail[]>;
  cancel(id: string): Promise<Result<void, Error>>;
}
