/**
 * File:        apps/backend/src/core/application/use-cases/feature/set-flag/set-flag.command.ts
 * Module:      Feature Flag Use Cases
 * Purpose:     Command for SetFlag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { SetFlagDto } from './set-flag.dto';

export class SetFlagCommand {
  constructor(public readonly input: SetFlagDto) {}
}
