/**
 * File:        apps/backend/src/core/application/use-cases/feature/set-flag/set-flag.handler.ts
 * Module:      Feature Flag Use Cases
 * Purpose:     Create or update a feature flag (global or workspace-scoped)
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { FEATURE_FLAG_REPOSITORY, IFeatureFlagRepository } from '../../../ports/repositories/feature-flag.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { FeatureFlag } from '../../../../domain/bounded-contexts/feature/feature-flag.aggregate';
import { SetFlagCommand } from './set-flag.command';

@Injectable()
export class SetFlagHandler {
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private featureFlagRepo: IFeatureFlagRepository,
  ) {}

  async execute(command: SetFlagCommand): Promise<Result<FeatureFlag, ApplicationError>> {
    const workspaceId = command.input.workspaceId ?? null;

    const createResult = FeatureFlag.create({
      key: command.input.key,
      workspaceId,
      enabled: command.input.enabled,
      rolloutPercent: command.input.rolloutPercent,
    });

    if (createResult.isErr()) {
      return Result.err(new ApplicationError('FLAG_CREATE_FAILED', createResult.error.message));
    }

    const flag = createResult.value;
    const saveResult = await this.featureFlagRepo.save(flag);
    if (saveResult.isErr()) {
      return Result.err(new ApplicationError('FLAG_SAVE_FAILED', saveResult.error.message));
    }

    return Result.ok(flag);
  }
}
