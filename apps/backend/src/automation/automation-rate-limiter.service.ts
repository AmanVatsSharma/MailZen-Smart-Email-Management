/**
 * File:        apps/backend/src/automation/automation-rate-limiter.service.ts
 * Module:      Automation Engine · Rate Limiting
 * Purpose:     Per-action in-process rate limits for automation step execution.
 *              Prevents a single workspace from exhausting downstream quotas
 *              (Slack API, external webhooks, email sends, AI providers) via
 *              automation runs.
 *
 * Exports:
 *   - AutomationRateLimiterService  — Injectable service
 *     - checkActionRate(workspaceId, actionType) → { allowed, retryAfterSeconds }
 *
 * Depends on:
 *   - RequestRateLimiter  — in-process sliding-window counter from common/rate-limit
 *
 * Side-effects:
 *   - none — pure in-memory counters; resets on process restart
 *
 * Key invariants:
 *   - Limits are hardcoded in v1; override via env vars in v1.1
 *   - Rate limit keys are scoped per workspace + action type
 *   - Unknown action types are always allowed (fail open)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable } from '@nestjs/common';
import { RequestRateLimiter } from '../common/rate-limit/request-rate-limiter';

const HOUR_MS = 60 * 60 * 1000;

/** Per-action limits: max requests per workspace per hour. */
const ACTION_LIMITS: Record<string, number> = {
  'email.draft.send': 50,
  'email.draft.create': 200,
  'webhook.post': 200,
  'notify.slack': 200,
  'notify.user': 500,
  'ai.classify': 100,
  'ai.summarize': 100,
  'ai.draft.reply': 100,
  'email.label.add': 1_000,
  'email.label.remove': 1_000,
  'email.archive': 1_000,
  'email.assign': 500,
  'delay': 1_000,
};

@Injectable()
export class AutomationRateLimiterService {
  private readonly limiters = new Map<string, RequestRateLimiter>();

  checkActionRate(
    workspaceId: string,
    actionType: string,
  ): { allowed: boolean; retryAfterSeconds: number } {
    const maxRequests = ACTION_LIMITS[actionType];
    if (maxRequests === undefined) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const limiterKey = actionType;
    let limiter = this.limiters.get(limiterKey);
    if (!limiter) {
      limiter = new RequestRateLimiter({ windowMs: HOUR_MS, maxRequests });
      this.limiters.set(limiterKey, limiter);
    }

    const result = limiter.consume(`${workspaceId}:${actionType}`);
    return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
  }
}
