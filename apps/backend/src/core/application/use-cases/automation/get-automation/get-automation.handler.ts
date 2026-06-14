/**
 * File:        apps/backend/src/core/application/use-cases/automation/get-automation/get-automation.handler.ts
 * Module:      Automation Use Cases
 * Purpose:     Get a specific automation version by its versionId
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { Injectable, Inject } from '@nestjs/common';
import { AUTOMATION_REPOSITORY, IAutomationRepository } from '../../ports/repositories/automation.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { Automation } from '../../../../domain/bounded-contexts/automation/automation.aggregate';
import { GetAutomationCommand } from './get-automation.command';

@Injectable()
export class GetAutomationHandler {
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private automationRepo: IAutomationRepository,
  ) {}

  async execute(command: GetAutomationCommand): Promise<Result<Automation | null, ApplicationError>> {
    const automation = await this.automationRepo.findByVersionId(command.input.versionId);
    
    // null means not found, not an error
    return Result.ok(automation);
  }
}
