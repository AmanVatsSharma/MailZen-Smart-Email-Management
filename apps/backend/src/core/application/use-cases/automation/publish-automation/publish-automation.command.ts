/**
 * File:        apps/backend/src/core/application/use-cases/automation/publish-automation/publish-automation.command.ts
 * Module:      Automation Use Cases
 * Purpose:     Command for PublishAutomation use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { PublishAutomationDto } from './publish-automation.dto';

export class PublishAutomationCommand {
  constructor(public readonly input: PublishAutomationDto) {}
}
