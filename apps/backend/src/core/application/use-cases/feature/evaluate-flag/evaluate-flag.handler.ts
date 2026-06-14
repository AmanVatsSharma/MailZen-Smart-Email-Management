/**
 * File:        apps/backend/src/core/application/use-cases/feature/evaluate-flag/evaluate-flag.handler.ts
 * Module:      Feature Flag Use Cases
 * Purpose:     Evaluate whether a feature flag is on for a workspace (workspace override first, then global)
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { FEATURE_FLAG_REPOSITORY, IFeatureFlagRepository } from '../../ports/repositories/feature-flag.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { EvaluateFlagCommand } from './evaluate-flag.command';

@Injectable()
export class EvaluateFlagHandler {
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private featureFlagRepo: IFeatureFlagRepository,
  ) {}

  async execute(command: EvaluateFlagCommand): Promise<Result<boolean, ApplicationError>> {
    if (!command.input.key) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'key is required'));
    }
    if (!command.input.workspaceId) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'workspaceId is required'));
    }

    const bucket = command.input.bucket ?? 0;

    // 1. Workspace-specific override takes precedence
    const override = await this.featureFlagRepo.findByKey(command.input.key, command.input.workspaceId);
    if (override && override.workspaceId === command.input.workspaceId) {
      return Result.ok(override.isOnFor(command.input.workspaceId, bucket));
    }

    // 2. Fall back to the global default
    const global = await this.featureFlagRepo.findByKey(command.input.key, null);
    if (!global) {
      return Result.ok(false);
    }
    return Result.ok(global.isOnFor(command.input.workspaceId, bucket));
  }
}
