/**
 * File:        apps/backend/src/core/application/use-cases/email-analytics/get-email-stats/get-email-stats.command.ts
 * Module:      Email Analytics Use Cases
 * Purpose:     Command for GetEmailStats use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { GetEmailStatsDto } from './get-email-stats.dto';

export class GetEmailStatsCommand {
  constructor(public readonly input: GetEmailStatsDto) {}
}
