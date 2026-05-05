/**
 * File:        apps/backend/src/automation/actions/delay.action.ts
 * Module:      Automation Engine · Action
 * Purpose:     Suspends an automation run for a configurable duration by re-enqueueing
 *              the Bull job with a delay. The current execution stops immediately after
 *              this step; the re-enqueued job resumes from the next step.
 *
 * Exports:
 *   - DelayActionHandler  — Injectable handler for 'delay'
 *
 * Depends on:
 *   - @nestjs/bull InjectQueue('automations')  — to re-enqueue the delayed job
 *   - AUTOMATION_JOB_TYPE from automation-dispatcher.service  — job name constant
 *
 * Side-effects:
 *   - Enqueues a new Bull job on the 'automations' queue with the configured delay
 *
 * Key invariants:
 *   - Returns { delayed: true } to signal the worker to stop the current loop
 *   - Worker will leave the run in RUNNING state; the resumed job completes it
 *   - delayMs clamped to [1000, 86_400_000] (1 s → 24 h) to prevent abuse
 *   - If delayMs is missing or invalid, defaults to 60_000 ms (1 minute)
 *
 * Read order:
 *   1. execute()  — main handler logic
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-05
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AutomationStep, DelayStep } from '@mailzen/shared-types';
import { ActionContext, ActionHandler, ActionResult } from './action.interface';
import { AUTOMATION_JOB_TYPE } from '../automation-dispatcher.service';
import { serializeStructuredLog } from '../../common/logging/structured-log.util';

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 86_400_000; // 24 hours
const DEFAULT_DELAY_MS = 60_000; // 1 minute

@Injectable()
export class DelayActionHandler implements ActionHandler {
  private readonly logger = new Logger(DelayActionHandler.name);
  readonly actionType = 'delay' as const;

  constructor(
    @InjectQueue('automations')
    private readonly queue: Queue,
  ) {}

  async execute(step: AutomationStep, ctx: ActionContext): Promise<ActionResult> {
    if (step.type !== 'delay') return { skipped: true };

    const delayStep = step as DelayStep;
    const rawMs = typeof delayStep.delayMs === 'number' ? delayStep.delayMs : DEFAULT_DELAY_MS;
    const delayMs = Math.min(Math.max(rawMs, MIN_DELAY_MS), MAX_DELAY_MS);

    const resumeAt = new Date(Date.now() + delayMs);

    await this.queue.add(
      AUTOMATION_JOB_TYPE,
      { runId: ctx.runId, startFromStepIndex: ctx.stepIndex + 1 },
      { delay: delayMs },
    );

    this.logger.log(
      serializeStructuredLog({
        event: 'automation_delay_enqueued',
        runId: ctx.runId,
        stepIndex: ctx.stepIndex,
        delayMs,
        resumeAt: resumeAt.toISOString(),
        correlationId: ctx.correlationId,
      }),
    );

    return { delayed: true, data: { delayMs, resumeAt: resumeAt.toISOString() } };
  }
}
