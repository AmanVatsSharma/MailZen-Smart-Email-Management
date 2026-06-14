/**
 * File:        apps/backend/src/core/application/use-cases/automation/list-automations/list-automations.handler.ts
 * Module:      Automation Use Cases
 * Purpose:     List all automations for a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { Injectable, Inject } from '@nestjs/common';
import { AUTOMATION_REPOSITORY, IAutomationRepository } from '../../ports/repositories/automation.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { Automation } from '../../../../domain/bounded-contexts/automation/automation.aggregate';
import { ListAutomationsCommand } from './list-automations.command';

@Injectable()
export class ListAutomationsHandler {
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private automationRepo: IAutomationRepository,
  ) {}

  async execute(command: ListAutomationsCommand): Promise<Result<Automation[], ApplicationError>> {
    const automations = await this.automationRepo.listForWorkspace(command.input.workspaceId);
    
    return Result.ok(automations);
  }
}
