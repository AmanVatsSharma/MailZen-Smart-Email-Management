/**
 * File:        apps/backend/src/core/application/use-cases/automation/get-automation/get-automation.command.ts
 * Module:      Automation Use Cases
 * Purpose:     Command for GetAutomation use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { GetAutomationDto } from './get-automation.dto';

export class GetAutomationCommand {
  constructor(public readonly input: GetAutomationDto) {}
}
