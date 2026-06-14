/**
 * File:        apps/backend/src/core/application/use-cases/automation/update-automation/update-automation.command.ts
 * Module:      Automation Use Cases
 * Purpose:     Command for UpdateAutomation use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { UpdateAutomationDto } from './update-automation.dto';

export class UpdateAutomationCommand {
  constructor(public readonly input: UpdateAutomationDto) {}
}
