/**
 * File:        apps/backend/src/core/application/use-cases/automation/create-automation/create-automation.handler.ts
 * Module:      Automation Use Cases
 * Purpose:     Create a new automation draft version
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-14
 */

import { Injectable, Inject } from '@nestjs/common';
import { AUTOMATION_REPOSITORY, IAutomationRepository } from '../../../ports/repositories/automation.repository';
import { IEventBus, EVENT_BUS } from '../../../ports/event-bus/event-bus';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Automation } from '../../../../domain/bounded-contexts/automation/automation.aggregate';
import { CreateAutomationCommand } from './create-automation.command';

@Injectable()
export class CreateAutomationHandler {
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private automationRepo: IAutomationRepository,
    @Inject(EVENT_BUS)
    private eventBus: IEventBus,
  ) {}

  async execute(command: CreateAutomationCommand): Promise<Result<Automation, ApplicationError>> {
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

    const automation = automationResult.value;
    const saveResult = await this.automationRepo.save(automation);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('AUTOMATION_SAVE_FAILED', saveResult.error.message));
    }

    await this.eventBus.publishAll(automation.pullDomainEvents());

    return Result.ok(automation);
  }
}
