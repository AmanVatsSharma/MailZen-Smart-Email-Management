/**
 * File:        core/application/ports/repositories/feature-flag.repository.ts
 * Module:      Application - Feature Flag Bounded Context
 * Purpose:     Port for feature flag persistence.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { FeatureFlag } from '../../../domain/bounded-contexts/feature/feature-flag.aggregate';
import { Result } from '../../../domain/shared/result';

export const FEATURE_FLAG_REPOSITORY = Symbol('IFeatureFlagRepository');

export interface IFeatureFlagRepository {
  save(flag: FeatureFlag): Promise<Result<void, Error>>;
  findByKey(key: string, workspaceId: string | null): Promise<FeatureFlag | null>;
  listAll(): Promise<FeatureFlag[]>;
}
