/**
 * File:        apps/backend/src/core/application/use-cases/organization/create-label/create-label.handler.ts
 * Module:      Organization Use Cases
 * Purpose:     Create a new label in a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { LABEL_REPOSITORY, ILabelRepository } from '../../ports/repositories/label.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { Label } from '../../../../domain/bounded-contexts/organization/label.aggregate';
import { WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { CreateLabelCommand } from './create-label.command';

@Injectable()
export class CreateLabelHandler {
  constructor(
    @Inject(LABEL_REPOSITORY)
    private labelRepo: ILabelRepository,
  ) {}

  async execute(command: CreateLabelCommand): Promise<Result<Label, ApplicationError>> {
    if (!command.input.name?.trim()) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'Label name is required'));
    }

    const createResult = Label.create({
      workspaceId: WorkspaceId.from(command.input.workspaceId),
      name: command.input.name,
      color: command.input.color,
      parentId: command.input.parentId ?? null,
    });

    if (createResult.isErr()) {
      return Result.err(new ApplicationError('LABEL_CREATE_FAILED', createResult.error.message));
    }

    const label = createResult.value;
    const saveResult = await this.labelRepo.save(label);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('LABEL_SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(label);
  }
}
