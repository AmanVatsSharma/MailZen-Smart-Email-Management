/**
 * File:        apps/backend/src/core/application/use-cases/automation/create-automation/create-automation.command.ts
 * Module:      Automation Use Cases
 * Purpose:     Command for CreateAutomation use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { CreateAutomationDto } from './create-automation.dto';

export class CreateAutomationCommand {
  constructor(public readonly input: CreateAutomationDto) {}
}
