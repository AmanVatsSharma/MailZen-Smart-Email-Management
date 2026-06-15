/**
 * File:        apps/backend/src/core/application/use-cases/feature/list-flags/list-flags.handler.ts
 * Module:      Feature Flag Use Cases
 * Purpose:     List all feature flags (global defaults and workspace overrides)
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { FEATURE_FLAG_REPOSITORY, IFeatureFlagRepository } from '../../../ports/repositories/feature-flag.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { FeatureFlag } from '../../../../domain/bounded-contexts/feature/feature-flag.aggregate';
import { ListFlagsCommand } from './list-flags.command';

@Injectable()
export class ListFlagsHandler {
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private featureFlagRepo: IFeatureFlagRepository,
  ) {}

  async execute(_command: ListFlagsCommand): Promise<Result<FeatureFlag[], ApplicationError>> {
    const flags = await this.featureFlagRepo.listAll();
    return Result.ok(flags);
  }
}
