/**
 * File:        apps/backend/src/core/application/use-cases/ai/list-triage-results/list-triage-results.handler.ts
 * Module:      AI · Use Case
 * Purpose:     List recent triage results for a user. Used by the
 *              frontend inbox to render the AI triage panel.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result, makeResult } from '../../../../domain/shared/result';
import { TriageResult, TriagePriority, TriageCategory } from '../../../../domain/bounded-contexts/ai/triage-result.aggregate';
import { TRIAGE_RESULT_REPOSITORY, ITriageResultRepository, TriageResultFilters } from '../../../ports/repositories/triage-result.repository';

export interface ListTriageResultsInput {
  userId: string;
  workspaceId?: string;
  filters?: {
    priority?: TriagePriority;
    category?: TriageCategory;
  };
  limit?: number;
}

export interface ListTriageResultsOutput {
  results: TriageResult[];
  total: number;
}

@Injectable()
export class ListTriageResultsHandler {
  private static readonly DEFAULT_LIMIT = 50;
  private static readonly MAX_LIMIT = 200;

  constructor(
    @Inject(TRIAGE_RESULT_REPOSITORY)
    private readonly triageRepo: ITriageResultRepository,
  ) {}

  async execute(
    input: ListTriageResultsInput,
  ): Promise<Result<ListTriageResultsOutput, never>> {
    const filters: TriageResultFilters | undefined = input.filters;
    const limit = Math.min(
      input.limit ?? ListTriageResultsHandler.DEFAULT_LIMIT,
      ListTriageResultsHandler.MAX_LIMIT,
    );

    const all = await this.triageRepo.findByUserId(input.userId, filters);
    const results = filters || input.workspaceId
      ? all.filter((r) => {
          if (input.workspaceId && r.workspaceId !== input.workspaceId) return false;
          return true;
        })
      : all;

    return makeResult(Result.ok({
      results: results.slice(0, limit),
      total: results.length,
    }));
  }
}
