/**
 * File:        apps/backend/src/core/application/use-cases/organization/list-labels/list-labels.handler.ts
 * Module:      Organization Use Cases
 * Purpose:     List all labels for a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { LABEL_REPOSITORY, ILabelRepository } from '../../ports/repositories/label.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { Label } from '../../../../domain/bounded-contexts/organization/label.aggregate';
import { WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { ListLabelsCommand } from './list-labels.command';

@Injectable()
export class ListLabelsHandler {
  constructor(
    @Inject(LABEL_REPOSITORY)
    private labelRepo: ILabelRepository,
  ) {}

  async execute(command: ListLabelsCommand): Promise<Result<Label[], ApplicationError>> {
    if (!command.input.workspaceId) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'workspaceId is required'));
    }

    const labels = await this.labelRepo.listByWorkspace(WorkspaceId.from(command.input.workspaceId));
    return Result.ok(labels);
  }
}
