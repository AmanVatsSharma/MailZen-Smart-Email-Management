/**
 * File:        apps/backend/src/core/application/use-cases/feature/evaluate-flag/evaluate-flag.command.ts
 * Module:      Feature Flag Use Cases
 * Purpose:     Command for EvaluateFlag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { EvaluateFlagDto } from './evaluate-flag.dto';

export class EvaluateFlagCommand {
  constructor(public readonly input: EvaluateFlagDto) {}
}
