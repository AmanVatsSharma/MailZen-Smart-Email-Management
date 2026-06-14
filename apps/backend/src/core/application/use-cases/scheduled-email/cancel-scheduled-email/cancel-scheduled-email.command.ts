/**
 * File:        apps/backend/src/core/application/use-cases/scheduled-email/cancel-scheduled-email/cancel-scheduled-email.command.ts
 * Module:      Scheduled Email Use Cases
 * Purpose:     Command for CancelScheduledEmail use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { CancelScheduledEmailDto } from './cancel-scheduled-email.dto';

export class CancelScheduledEmailCommand {
  constructor(public readonly input: CancelScheduledEmailDto) {}
}
