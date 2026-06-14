/**
 * File:        apps/backend/src/core/application/use-cases/email-analytics/record-event/record-event.command.ts
 * Module:      Email Analytics Use Cases
 * Purpose:     Command for RecordEvent use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RecordEventDto } from './record-event.dto';

export class RecordEventCommand {
  constructor(public readonly input: RecordEventDto) {}
}
