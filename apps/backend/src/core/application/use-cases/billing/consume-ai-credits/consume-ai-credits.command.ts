/**
 * File:        apps/backend/src/core/application/use-cases/billing/consume-ai-credits/consume-ai-credits.command.ts
 * Module:      Billing Use Cases
 * Purpose:     Command for ConsumeAiCredits use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ConsumeAiCreditsDto } from './consume-ai-credits.dto';

export class ConsumeAiCreditsCommand {
  constructor(public readonly input: ConsumeAiCreditsDto) {}
}
