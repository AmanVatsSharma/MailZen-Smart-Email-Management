/**
 * File:        apps/backend/src/automation/automation-worker.processor.ts
 * Module:      Automation Engine · Worker
 * Purpose:     Bull job processor for the "automations" queue. For each enqueued run:
 *              1. Loads AutomationRun + AutomationVersion from DB
 *              2. Checks for CANCELED status before each step (graceful abort)
 *              3. Executes steps sequentially via the registered ActionHandler registry
 *              4. Persists AutomationStepRun rows with input/output for the audit trail
 *              5. Retries failed steps up to MAX_STEP_ATTEMPTS (3) with exponential backoff
 *              6. Marks the run terminal (SUCCEEDED / FAILED) when all steps complete
 *
 * Exports:
 *   - AutomationWorkerProcessor  — Injectable NestJS Bull Processor
 *
 * Depends on:
 *   - @nestjs/bull               — @Processor, @Process, Job
 *   - AutomationRun              — TypeORM repository for run state
 *   - AutomationVersion          — TypeORM repository for step definitions
 *   - AutomationStepRun          — TypeORM repository for per-step audit rows
 *   - ActionHandler[]            — injected array of all registered action handlers
 *   - BillingService             — AI credit debit for ai.* steps
 *
 * Side-effects:
 *   - DB reads (run + version) and writes (step rows, run status updates)
 *   - Calls action handlers which may make external API calls
 *   - Calls BillingService.consumeAiCredits after each successful ai.* step
 *
 * Key invariants:
 *   - Worker reads run status before each step; CANCELED → immediate abort
 *   - Steps use 0-based index matching AutomationVersion.steps array position
 *   - Each step attempt is a separate AutomationStepRun row (runId, stepIndex, attempt)
 *   - Bull job-level retries are disabled (attempts: 1 set by dispatcher); retry is per-step
 *   - SKIPPED steps (from action handler returning { skipped: true }) count as success
 *   - AI credit debit is fire-and-forget; credit failure does not block step success
 *
 * Read order:
 *   1. AUTOMATION_JOB_TYPE / MAX_STEP_ATTEMPTS / STEP_RETRY_BASE_DELAY_MS — constants
 *   2. AutomationWorkerProcessor — class
 *   3. processRun               — main job handler
 *   4. executeStep              — per-step execution with retry
 *   5. debitAiCredits           — post-step credit accounting
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Repository } from 'typeorm';
import { AutomationEvent, AutomationStep } from '@mailzen/shared-types';
import { AutomationRun, AutomationRunStatus } from './entities/automation-run.entity';
import { AutomationVersion } from './entities/automation-version.entity';
import { AutomationStepRun, AutomationStepRunStatus } from './entities/automation-step-run.entity';
import { ActionContext, ActionHandler, ActionResult } from './actions/action.interface';
import { AUTOMATION_JOB_TYPE } from './automation-dispatcher.service';
import { AutomationRateLimiterService } from './automation-rate-limiter.service';
import { BillingService } from '../billing/billing.service';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

// Action handler token used in module DI — matches AUTOMATION_ACTION_HANDLERS injection token
export const AUTOMATION_ACTION_HANDLERS = 'AUTOMATION_ACTION_HANDLERS';

const MAX_STEP_ATTEMPTS = 3;
const STEP_RETRY_BASE_DELAY_MS = 500;

@Injectable()
@Processor('automations')
export class AutomationWorkerProcessor {
  private readonly logger = new Logger(AutomationWorkerProcessor.name);

  constructor(
    @InjectRepository(AutomationRun)
    private readonly runRepo: Repository<AutomationRun>,
    @InjectRepository(AutomationVersion)
    private readonly versionRepo: Repository<AutomationVersion>,
    @InjectRepository(AutomationStepRun)
    private readonly stepRunRepo: Repository<AutomationStepRun>,
    @Inject(AUTOMATION_ACTION_HANDLERS)
    private readonly actionHandlers: ActionHandler[],
    private readonly rateLimiter: AutomationRateLimiterService,
    private readonly billingService: BillingService,
  ) {}

  @Process(AUTOMATION_JOB_TYPE)
  async processRun(job: Job<{ runId: string; startFromStepIndex?: number }>): Promise<void> {
    const { runId, startFromStepIndex = 0 } = job.data;

    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) {
      this.logger.warn(
        serializeStructuredLog({ event: 'automation_worker_run_not_found', runId }),
      );
      return;
    }

    const version = await this.versionRepo.findOne({
      where: { id: run.automationVersionId },
    });
    if (!version) {
      await this.markRunFailed(run, 'VERSION_NOT_FOUND', 'AutomationVersion row missing');
      return;
    }

    const steps = (version.steps as AutomationStep[]) ?? [];
    if (!steps.length) {
      await this.markRunSucceeded(run);
      return;
    }

    await this.runRepo.update(run.id, {
      status: AutomationRunStatus.RUNNING,
      startedAt: new Date(),
    });

    this.logger.log(
      serializeStructuredLog({
        event: 'automation_worker_run_started',
        runId: run.id,
        automationId: run.automationId,
        stepCount: steps.length,
        correlationId: run.correlationId,
      }),
    );

    const triggerEvent = run.triggerEvent as unknown as AutomationEvent;
    const previousStepOutputs: Record<number, ActionResult> = {};
    let runFailed = false;
    let runDelayed = false;

    for (let stepIndex = startFromStepIndex; stepIndex < steps.length; stepIndex++) {
      // Check for cancellation before each step
      const freshRun = await this.runRepo.findOne({
        where: { id: runId },
        select: ['id', 'status'],
      });
      if (freshRun?.status === AutomationRunStatus.CANCELED) {
        this.logger.log(
          serializeStructuredLog({
            event: 'automation_worker_run_canceled',
            runId,
            stoppedAtStepIndex: stepIndex,
            correlationId: run.correlationId,
          }),
        );
        return;
      }

      const step = steps[stepIndex];
      const ctx: ActionContext = {
        workspaceId: run.workspaceId,
        userId: triggerEvent?.userId ?? '',
        runId,
        stepIndex,
        correlationId: run.correlationId,
        triggerEvent,
        previousStepOutputs,
      };

      const result = await this.executeStep(step, ctx, run.correlationId);

      if (result.failed) {
        runFailed = true;
        break;
      }
      if (result.output?.delayed) {
        // Delay action re-enqueued the job; stop this execution without marking terminal
        runDelayed = true;
        break;
      }
      previousStepOutputs[stepIndex] = result.output!;
    }

    if (runDelayed) {
      // Leave run in RUNNING state — the re-enqueued delayed job will complete it
      return;
    }
    if (runFailed) {
      await this.runRepo.update(runId, {
        status: AutomationRunStatus.FAILED,
        finishedAt: new Date(),
      });
    } else {
      await this.markRunSucceeded(run);
    }

    this.logger.log(
      serializeStructuredLog({
        event: runFailed ? 'automation_worker_run_failed' : 'automation_worker_run_succeeded',
        runId,
        automationId: run.automationId,
        correlationId: run.correlationId,
      }),
    );
  }

  private async executeStep(
    step: AutomationStep,
    ctx: ActionContext,
    correlationId: string,
  ): Promise<{ failed: boolean; output?: ActionResult }> {
    const handler = this.actionHandlers.find((h) => h.actionType === step.type);
    if (!handler) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'automation_worker_no_handler',
          stepType: step.type,
          stepIndex: ctx.stepIndex,
          runId: ctx.runId,
          correlationId,
        }),
      );
      await this.stepRunRepo.save(
        this.stepRunRepo.create({
          runId: ctx.runId,
          stepIndex: ctx.stepIndex,
          stepType: step.type,
          status: AutomationStepRunStatus.SKIPPED,
          attempt: 1,
          errorCode: 'NO_HANDLER',
          errorMessage: `No handler registered for action type: ${step.type}`,
          startedAt: new Date(),
          finishedAt: new Date(),
        }),
      );
      return { failed: false, output: { skipped: true } };
    }

    // Per-action rate limit check (fail-fast before DB writes)
    const rateCheck = this.rateLimiter.checkActionRate(ctx.workspaceId, step.type);
    if (!rateCheck.allowed) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'automation_step_rate_limited',
          stepType: step.type,
          workspaceId: ctx.workspaceId,
          runId: ctx.runId,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        }),
      );
      await this.stepRunRepo.save(
        this.stepRunRepo.create({
          runId: ctx.runId,
          stepIndex: ctx.stepIndex,
          stepType: step.type,
          status: AutomationStepRunStatus.SKIPPED,
          attempt: 1,
          errorCode: 'RATE_LIMITED',
          errorMessage: `Action type ${step.type} is rate-limited. Retry after ${rateCheck.retryAfterSeconds}s.`,
          startedAt: new Date(),
          finishedAt: new Date(),
        }),
      );
      return { failed: false, output: { skipped: true } };
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_STEP_ATTEMPTS; attempt++) {
      const stepRun = await this.stepRunRepo.save(
        this.stepRunRepo.create({
          runId: ctx.runId,
          stepIndex: ctx.stepIndex,
          stepType: step.type,
          status: attempt === 1
            ? AutomationStepRunStatus.RUNNING
            : AutomationStepRunStatus.RETRYING,
          input: step as unknown as Record<string, unknown>,
          attempt,
          startedAt: new Date(),
        }),
      );

      try {
        const result = await handler.execute(step, ctx);
        await this.stepRunRepo.save({
          ...stepRun,
          status: result.skipped
            ? AutomationStepRunStatus.SKIPPED
            : AutomationStepRunStatus.SUCCEEDED,
          output: result as unknown as Record<string, unknown>,
          finishedAt: new Date(),
        });

        // Debit AI credits for ai.* steps (fire-and-forget; never fails the step)
        if (!result.skipped && result.creditsConsumed && ctx.userId) {
          this.debitAiCredits(ctx.userId, result.creditsConsumed, ctx.runId, step.type).catch(() => {
            // Intentionally silent — billing failure must not block execution
          });
        }

        this.logger.debug(
          serializeStructuredLog({
            event: 'automation_worker_step_succeeded',
            runId: ctx.runId,
            stepIndex: ctx.stepIndex,
            stepType: step.type,
            attempt,
            skipped: result.skipped ?? false,
            creditsConsumed: result.creditsConsumed ?? 0,
            correlationId,
          }),
        );
        return { failed: false, output: result };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await this.stepRunRepo.update(stepRun.id, {
          status: attempt < MAX_STEP_ATTEMPTS
            ? AutomationStepRunStatus.RETRYING
            : AutomationStepRunStatus.FAILED,
          errorCode: 'STEP_ERROR',
          errorMessage: lastError.message,
          finishedAt: new Date(),
        });

        this.logger.warn(
          serializeStructuredLog({
            event: 'automation_worker_step_attempt_failed',
            runId: ctx.runId,
            stepIndex: ctx.stepIndex,
            stepType: step.type,
            attempt,
            maxAttempts: MAX_STEP_ATTEMPTS,
            error: lastError.message,
            correlationId,
          }),
        );

        if (attempt < MAX_STEP_ATTEMPTS) {
          await new Promise((resolve) =>
            setTimeout(resolve, STEP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)),
          );
        }
      }
    }

    // All attempts exhausted — mark remaining steps SKIPPED
    const version = await this.versionRepo.findOne({
      where: { id: (await this.runRepo.findOne({ where: { id: ctx.runId }, select: ['automationVersionId'] }))!.automationVersionId },
    });
    const steps = (version?.steps as AutomationStep[]) ?? [];
    for (let i = ctx.stepIndex + 1; i < steps.length; i++) {
      await this.stepRunRepo.save(
        this.stepRunRepo.create({
          runId: ctx.runId,
          stepIndex: i,
          stepType: steps[i].type,
          status: AutomationStepRunStatus.SKIPPED,
          attempt: 1,
          errorCode: 'PRIOR_STEP_FAILED',
          errorMessage: `Step ${ctx.stepIndex} (${step.type}) failed after ${MAX_STEP_ATTEMPTS} attempts`,
          startedAt: new Date(),
          finishedAt: new Date(),
        }),
      );
    }

    return { failed: true };
  }

  private async markRunSucceeded(run: AutomationRun): Promise<void> {
    await this.runRepo.update(run.id, {
      status: AutomationRunStatus.SUCCEEDED,
      finishedAt: new Date(),
    });
  }

  private async markRunFailed(
    run: AutomationRun,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await this.runRepo.update(run.id, {
      status: AutomationRunStatus.FAILED,
      errorCode,
      errorMessage,
      finishedAt: new Date(),
    });
    this.logger.error(
      serializeStructuredLog({
        event: 'automation_worker_run_failed_pre_execution',
        runId: run.id,
        errorCode,
        errorMessage,
        correlationId: run.correlationId,
      }),
    );
  }

  private async debitAiCredits(
    userId: string,
    credits: number,
    runId: string,
    stepType: string,
  ): Promise<void> {
    const result = await this.billingService.consumeAiCredits({
      userId,
      credits,
      requestId: `automation:${runId}:${stepType}`,
    });
    if (!result.allowed) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'automation_ai_credit_cap_reached',
          userId,
          stepType,
          runId,
          usedCredits: result.usedCredits,
          monthlyLimit: result.monthlyLimit,
        }),
      );
    }
  }
}
