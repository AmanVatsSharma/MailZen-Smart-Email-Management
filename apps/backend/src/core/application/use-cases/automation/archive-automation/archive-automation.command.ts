/**
 * File:        apps/backend/src/core/application/use-cases/automation/archive-automation/archive-automation.command.ts
 * Module:      Automation Use Cases
 * Purpose:     Command for ArchiveAutomation use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { ArchiveAutomationDto } from './archive-automation.dto';

export class ArchiveAutomationCommand {
  constructor(public readonly input: ArchiveAutomationDto) {}
}
