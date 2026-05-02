/**
 * File:        apps/backend/src/automation/automation-dispatcher.service.ts
 * Module:      Automation Engine · Dispatcher
 * Purpose:     Subscribes to AutomationEventBus at module init. For each event:
 *              1. Looks up ENABLED automations matching (workspaceId, trigger.type)
 *              2. Evaluates conditions in-process (synchronous, no I/O)
 *              3. Creates an automation_runs row in QUEUED state
 *              4. Enqueues a Bull job for the worker processor
 *
 * Exports:
 *   - AutomationDispatcherService  — Injectable NestJS service
 *
 * Depends on:
 *   - AutomationEventBus     — event subscription
 *   - Automation repository  — find enabled matching automations
 *   - AutomationVersion      — load trigger/conditions for each automation
 *   - AutomationRun          — persist QUEUED run row
 *   - Bull 'automations'     — enqueue worker job
 *   - evaluateCondition      — in-process condition tree evaluation
 *   - Workspace              — read kill switch + concurrency cap
 *
 * Side-effects:
 *   - DB reads (automations + versions + workspace) + DB write (automation_runs)
 *   - Bull enqueue
 *
 * Key invariants:
 *   - Kill switch: workspaces.automationsEnabled=false → no enqueue (§2.3)
 *   - Disabled automation → no enqueue even if event matches
 *   - Conditions fail → status=SKIPPED_CONDITIONS (run row still written for audit)
 *   - Dispatcher errors are caught per-event; one broken automation cannot block others
 *   - workspaceId enforced on every query (§2.3 tenancy invariant)
 *
 * Read order:
 *   1. onModuleInit       — subscribe to bus
 *   2. handleEvent        — the dispatch flow
 *   3. dispatchAutomation — per-automation matching + enqueue
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { Subscription } from 'rxjs';
import { AutomationEvent } from '@mailzen/shared-types';
import { AutomationEventBus } from './automation-event.bus';
import { Automation, AutomationStatus } from './entities/automation.entity';
import { AutomationVersion } from './entities/automation-version.entity';
import { AutomationRun, AutomationRunStatus } from './entities/automation-run.entity';
import { evaluateCondition } from './condition-evaluator';
import { Workspace } from '../workspace/entities/workspace.entity';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

export const AUTOMATION_JOB_TYPE = 'execute-run';

@Injectable()
export class AutomationDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationDispatcherService.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: AutomationEventBus,
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(AutomationVersion)
    private readonly versionRepo: Repository<AutomationVersion>,
    @InjectRepository(AutomationRun)
    private readonly runRepo: Repository<AutomationRun>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectQueue('automations')
    private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    this.subscription = this.eventBus.subscribe((event) => {
      this.handleEvent(event).catch((err: unknown) => {
        this.logger.error(
          serializeStructuredLog({
            event: 'automation_dispatcher_unhandled_error',
            triggerType: event.type,
            workspaceId: event.workspaceId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      });
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private async handleEvent(event: AutomationEvent): Promise<void> {
    const correlationId = resolveCorrelationId(event.correlationId);

    // Kill switch check
    const workspace = await this.workspaceRepo.findOne({
      where: { id: event.workspaceId },
      select: ['id', 'automationsEnabled', 'automationConcurrencyCap'],
    });
    if (!workspace?.automationsEnabled) return;

    // Find enabled automations for this workspace + trigger type
    const automations = await this.automationRepo.find({
      where: {
        workspaceId: event.workspaceId,
        status: AutomationStatus.ENABLED,
      },
    });

    const matching = automations.filter((a) => a.currentVersionId != null);
    if (!matching.length) return;

    // Dispatch each matching automation independently
    await Promise.allSettled(
      matching.map((automation) =>
        this.dispatchAutomation(automation, event, correlationId).catch((err: unknown) => {
          this.logger.warn(
            serializeStructuredLog({
              event: 'automation_dispatch_failed',
              automationId: automation.id,
              triggerType: event.type,
              workspaceId: event.workspaceId,
              correlationId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }),
      ),
    );
  }

  private async dispatchAutomation(
    automation: Automation,
    event: AutomationEvent,
    correlationId: string,
  ): Promise<void> {
    const version = await this.versionRepo.findOne({
      where: { id: automation.currentVersionId! },
    });
    if (!version) return;

    // Check trigger type matches
    const triggerConfig = version.trigger as { type?: string };
    if (triggerConfig?.type !== event.type) return;

    // Evaluate conditions
    let conditionsMet = true;
    if (version.conditions) {
      try {
        conditionsMet = evaluateCondition(
          version.conditions as Parameters<typeof evaluateCondition>[0],
          { event },
        );
      } catch {
        conditionsMet = false;
      }
    }

    const runStatus = conditionsMet
      ? AutomationRunStatus.QUEUED
      : AutomationRunStatus.SKIPPED_CONDITIONS;

    const run = await this.runRepo.save(
      this.runRepo.create({
        automationId: automation.id,
        automationVersionId: version.id,
        workspaceId: event.workspaceId,
        status: runStatus,
        triggerEvent: event as unknown as Record<string, unknown>,
        correlationId,
      }),
    );

    if (runStatus !== AutomationRunStatus.QUEUED) {
      this.logger.debug(
        serializeStructuredLog({
          event: 'automation_conditions_failed',
          automationId: automation.id,
          runId: run.id,
          correlationId,
        }),
      );
      return;
    }

    await this.queue.add(AUTOMATION_JOB_TYPE, { runId: run.id }, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.debug(
      serializeStructuredLog({
        event: 'automation_dispatched',
        automationId: automation.id,
        runId: run.id,
        triggerType: event.type,
        workspaceId: event.workspaceId,
        correlationId,
      }),
    );
  }
}
