/**
 * File:        apps/backend/src/core/application/use-cases/organization/delete-label/delete-label.handler.ts
 * Module:      Organization Use Cases
 * Purpose:     Delete a label after verifying it belongs to the given workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { LABEL_REPOSITORY, ILabelRepository } from '../../ports/repositories/label.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { DeleteLabelCommand } from './delete-label.command';

@Injectable()
export class DeleteLabelHandler {
  constructor(
    @Inject(LABEL_REPOSITORY)
    private labelRepo: ILabelRepository,
  ) {}

  async execute(command: DeleteLabelCommand): Promise<Result<void, ApplicationError>> {
    const label = await this.labelRepo.findById(command.input.id);
    if (!label) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Label not found'));
    }

    if (label.workspaceId !== command.input.workspaceId) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Cannot delete a label from another workspace'));
    }

    const deleteResult = await this.labelRepo.delete(label.id);
    if (deleteResult.isErr()) {
      return Result.err(new ApplicationError('DELETE_FAILED', deleteResult.error.message));
    }

    return Result.ok(undefined);
  }
}
