/**
 * File:        apps/backend/src/core/application/use-cases/automation/update-automation/update-automation.handler.ts
 * Module:      Automation Use Cases
 * Purpose:     Update an automation by creating a new immutable version.
 *              Each update creates a new version row with incremented version
 *              number; the previous version is never mutated.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { Injectable, Inject } from '@nestjs/common';
import { AUTOMATION_REPOSITORY, IAutomationRepository } from '../../../ports/repositories/automation.repository';
import { IEventBus, EVENT_BUS } from '../../../ports/event-bus/event-bus';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Automation } from '../../../../domain/bounded-contexts/automation/automation.aggregate';
import { AutomationStatus } from '../../../../domain/bounded-contexts/automation/value-objects/automation-status.vo';
import { UpdateAutomationCommand } from './update-automation.command';

@Injectable()
export class UpdateAutomationHandler {
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private automationRepo: IAutomationRepository,
    @Inject(EVENT_BUS)
    private eventBus: IEventBus,
  ) {}

  async execute(command: UpdateAutomationCommand): Promise<Result<Automation, ApplicationError>> {
    // Find the latest version for this workflow to compute the next version number
    const existing = await this.automationRepo.findPublishedByWorkflowId(command.input.workflowId);
    if (!existing) {
      return Result.err(new ApplicationError('AUTOMATION_NOT_FOUND', 'No existing automation found for this workflow'));
    }

    const nextVersion = existing.version + 1;

    // Create a new automation version (immutable - never update existing rows)
    const automationResult = Automation.create({
      workflowId: command.input.workflowId,
      workspaceId: command.input.workspaceId,
      name: command.input.name,
      trigger: command.input.trigger,
      conditions: command.input.conditions,
      steps: command.input.steps,
    });

    if (automationResult.isErr()) {
      return Result.err(new ApplicationError('AUTOMATION_CREATE_FAILED', automationResult.error.message));
    }

    // Reconstitute with the new version number
    const baseAutomation = automationResult.value;
    const newAutomation = Automation.reconstitute({
      versionId: crypto.randomUUID(),
      workflowId: baseAutomation.workflowId,
      workspaceId: baseAutomation.workspaceId,
      version: nextVersion,
      name: baseAutomation.name,
      trigger: baseAutomation.trigger,
      conditions: [...baseAutomation.conditions],
      steps: [...baseAutomation.steps],
      status: AutomationStatus.draft(),
      publishedAt: null,
      createdAt: new Date(),
    });

    const saveResult = await this.automationRepo.save(newAutomation);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('AUTOMATION_SAVE_FAILED', saveResult.error.message));
    }

    await this.eventBus.publishAll(newAutomation.pullDomainEvents());

    return Result.ok(newAutomation);
  }
}
