/**
 * File:        apps/backend/src/core/application/use-cases/scheduled-email/schedule-email/schedule-email.command.ts
 * Module:      Scheduled Email Use Cases
 * Purpose:     Command for ScheduleEmail use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ScheduleEmailDto } from './schedule-email.dto';

export class ScheduleEmailCommand {
  constructor(public readonly input: ScheduleEmailDto) {}
}
