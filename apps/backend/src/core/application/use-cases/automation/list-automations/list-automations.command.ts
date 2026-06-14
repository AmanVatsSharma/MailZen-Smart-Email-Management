/**
 * File:        apps/backend/src/core/application/use-cases/automation/list-automations/list-automations.command.ts
 * Module:      Automation Use Cases
 * Purpose:     Command for ListAutomations use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { ListAutomationsDto } from './list-automations.dto';

export class ListAutomationsCommand {
  constructor(public readonly input: ListAutomationsDto) {}
}
