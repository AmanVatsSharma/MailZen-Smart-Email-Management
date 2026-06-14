/**
 * File:        apps/backend/src/core/application/use-cases/automation/archive-automation/archive-automation.handler.ts
 * Module:      Automation Use Cases
 * Purpose:     Archive a published automation by setting its status to archived
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { Injectable, Inject } from '@nestjs/common';
import { AUTOMATION_REPOSITORY, IAutomationRepository } from '../../ports/repositories/automation.repository';
import { IEventBus, EVENT_BUS } from '../../ports/event-bus/event-bus';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { Automation } from '../../../../domain/bounded-contexts/automation/automation.aggregate';
import { ArchiveAutomationCommand } from './archive-automation.command';

@Injectable()
export class ArchiveAutomationHandler {
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private automationRepo: IAutomationRepository,
    @Inject(EVENT_BUS)
    private eventBus: IEventBus,
  ) {}

  async execute(command: ArchiveAutomationCommand): Promise<Result<Automation, ApplicationError>> {
    // Find the published version for this workflow
    const published = await this.automationRepo.findPublishedByWorkflowId(command.input.workflowId);
    
    if (!published) {
      return Result.err(new ApplicationError('AUTOMATION_NOT_FOUND', 'No published automation found for this workflow'));
    }

    if (published.status.isArchived()) {
      return Result.err(new ApplicationError('ALREADY_ARCHIVED', 'Automation is already archived'));
    }

    // Archive the automation - creates a new version with archived status
    const archivedAutomation = published.archive();
    
    const saveResult = await this.automationRepo.save(archivedAutomation);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    await this.eventBus.publishAll(archivedAutomation.pullDomainEvents());

    return Result.ok(archivedAutomation);
  }
}
