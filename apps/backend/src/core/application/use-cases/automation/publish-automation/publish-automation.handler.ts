/**
 * File:        apps/backend/src/core/application/use-cases/automation/publish-automation/publish-automation.handler.ts
 * Module:      Automation Use Cases
 * Purpose:     Publish a draft automation by setting its status to published
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { Injectable, Inject } from '@nestjs/common';
import { AUTOMATION_REPOSITORY, IAutomationRepository } from '../../../ports/repositories/automation.repository';
import { IEventBus, EVENT_BUS } from '../../../ports/event-bus/event-bus';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Automation } from '../../../../domain/bounded-contexts/automation/automation.aggregate';
import { PublishAutomationCommand } from './publish-automation.command';

@Injectable()
export class PublishAutomationHandler {
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private automationRepo: IAutomationRepository,
    @Inject(EVENT_BUS)
    private eventBus: IEventBus,
  ) {}

  async execute(command: PublishAutomationCommand): Promise<Result<Automation, ApplicationError>> {
    // Find the latest version for this workflow
    const allVersions = await this.automationRepo.listForWorkspace(command.input.workspaceId);
    const latest = allVersions
      .filter(a => a.workflowId === command.input.workflowId)
      .sort((a, b) => b.version - a.version)[0];

    if (!latest) {
      return Result.err(new ApplicationError('AUTOMATION_NOT_FOUND', 'No automation found for this workflow'));
    }

    if (latest.status.isPublished()) {
      return Result.err(new ApplicationError('ALREADY_PUBLISHED', 'Automation is already published'));
    }

    // Publish the automation - creates a new version with published status
    const publishResult = latest.publish();
    if (publishResult.isErr()) {
      return Result.err(new ApplicationError('PUBLISH_FAILED', publishResult.error.message));
    }

    const publishedAutomation = publishResult.value;
    const saveResult = await this.automationRepo.save(publishedAutomation);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', saveResult.error.message));
    }

    await this.eventBus.publishAll(publishedAutomation.pullDomainEvents());

    return Result.ok(publishedAutomation);
  }
}
