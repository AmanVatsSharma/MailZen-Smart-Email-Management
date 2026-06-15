/**
 * File:        core/domain/bounded-contexts/feature/feature-flag.aggregate.ts
 * Module:      Domain - Feature Flag Bounded Context
 * Purpose:     Tenant-scoped feature flag. Either a global flag or a workspace override.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AggregateRoot } from '../../shared/aggregate-root';
import { Result } from '../../shared/result';

export interface FeatureFlagProps {
  key: string;
  workspaceId: string | null; // null = global default
  enabled: boolean;
  rolloutPercent: number; // 0-100 for gradual rollout
  createdAt: Date;
  updatedAt: Date;
}

export class FeatureFlag extends AggregateRoot<FeatureFlagProps> {
  get key(): string { return this.props.key; }
  get workspaceId(): string | null { return this.props.workspaceId; }
  get enabled(): boolean { return this.props.enabled; }
  get rolloutPercent(): number { return this.props.rolloutPercent; }

  private constructor(props: FeatureFlagProps) {
    super(props);
  }

  static create(input: {
    key: string;
    workspaceId?: string | null;
    enabled?: boolean;
    rolloutPercent?: number;
  }): Result<FeatureFlag, Error> {
    if (!/^[a-z][a-z0-9_.]{1,63}$/.test(input.key)) {
      return Result.err(new Error('Flag key must be lowercase snake_case'));
    }
    const pct = input.rolloutPercent ?? (input.enabled ? 100 : 0);
    if (pct < 0 || pct > 100) return Result.err(new Error('rolloutPercent must be 0-100'));
    const now = new Date();
    return Result.ok(new FeatureFlag({
      key: input.key,
      workspaceId: input.workspaceId ?? null,
      enabled: input.enabled ?? pct > 0,
      rolloutPercent: pct,
      createdAt: now,
      updatedAt: now,
    }));
  }

  static reconstitute(props: FeatureFlagProps): FeatureFlag {
    return new FeatureFlag(props);
  }

  isOnFor(workspaceId: string, hashedBucket: number): boolean {
    if (this.props.workspaceId && this.props.workspaceId !== workspaceId) {
      return false; // override is for a different workspace
    }
    if (!this.props.enabled) return false;
    return hashedBucket < this.props.rolloutPercent;
  }
}
