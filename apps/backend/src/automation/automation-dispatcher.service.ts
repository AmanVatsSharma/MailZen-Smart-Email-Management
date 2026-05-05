/**
 * File:        apps/backend/src/automation/automation-dispatcher.service.ts
 * Module:      Automation Engine · Dispatcher
 * Purpose:     Subscribes to AutomationEventBus at module init. For each event:
 *              1. Kill-switch check (workspaces.automationsEnabled, 30s in-process cache)
 *              2. Concurrency cap (active+queued runs vs workspace.automationConcurrencyCap)
 *              3. Loop detection (Redis sorted set, 10 runs / 60s per automation)
 *              4. Looks up ENABLED automations matching (workspaceId, trigger.type)
 *              5. Evaluates conditions in-process (synchronous, no I/O)
 *              6. Creates an automation_runs row in QUEUED state
 *              7. Enqueues a Bull job for the worker processor
 *
 * Exports:
 *   - AutomationDispatcherService  — Injectable NestJS service
 *   - AUTOMATION_JOB_TYPE          — Bull job type string
 *
 * Depends on:
 *   - AutomationEventBus     — event subscription
 *   - Automation repository  — find enabled matching automations
 *   - AutomationVersion      — load trigger/conditions for each automation
 *   - AutomationRun          — persist QUEUED run row + concurrency count
 *   - Bull 'automations'     — enqueue worker job + ioredis for loop detection
 *   - Workspace              — read kill switch + concurrency cap (30s TTL cache)
 *   - evaluateCondition      — in-process condition tree evaluation
 *
 * Side-effects:
 *   - DB reads (automations + versions + workspace) + DB write (automation_runs)
 *   - Bull enqueue
 *   - Redis sorted-set writes for loop detection
 *
 * Key invariants:
 *   - Kill switch: cache-backed 30s TTL; false means no enqueue (§2.3)
 *   - Concurrency cap: default 20 per workspace; hard-enforced before enqueue
 *   - Loop detection: refuses if automation fired > LOOP_THRESHOLD times in 60s
 *   - Dispatcher errors are caught per-event; one broken automation cannot block others
 *   - workspaceId enforced on every query (§2.3 tenancy invariant)
 *
 * Read order:
 *   1. onModuleInit            — subscribe to bus
 *   2. handleEvent             — kill-switch + concurrency check
 *   3. dispatchAutomation      — per-automation loop check + enqueue
 *   4. resolveWorkspaceConfig  — 30s TTL kill-switch cache
 *   5. checkLoop               — Redis sorted-set loop detection
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-06
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { In, Repository } from 'typeorm';
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

const KILL_SWITCH_CACHE_TTL_MS = 30_000;
const DEFAULT_CONCURRENCY_CAP = 20;
const LOOP_WINDOW_MS = 60_000;
const LOOP_THRESHOLD = parseInt(process.env.AUTOMATION_LOOP_THRESHOLD ?? '10', 10);

type KillSwitchEntry = { enabled: boolean; expiresAt: number; cap: number };

@Injectable()
export class AutomationDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationDispatcherService.name);
  private subscription?: Subscription;

  /** 30-second in-process cache for kill switch + concurrency cap per workspace. */
  private readonly killSwitchCache = new Map<string, KillSwitchEntry>();

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

    // Kill switch (cached 30 s)
    const wsConfig = await this.resolveWorkspaceConfig(event.workspaceId);
    if (!wsConfig.enabled) {
      this.logger.debug(
        serializeStructuredLog({
          event: 'automation_kill_switch_active',
          workspaceId: event.workspaceId,
        }),
      );
      return;
    }

    // Concurrency cap: count active + queued runs for this workspace
    const activeCount = await this.runRepo.count({
      where: {
        workspaceId: event.workspaceId,
        status: In([AutomationRunStatus.QUEUED, AutomationRunStatus.RUNNING]),
      },
    });
    if (activeCount >= wsConfig.cap) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'automation_concurrency_cap_reached',
          workspaceId: event.workspaceId,
          activeCount,
          cap: wsConfig.cap,
        }),
      );
      return;
    }

    const automations = await this.automationRepo.find({
      where: {
        workspaceId: event.workspaceId,
        status: AutomationStatus.ENABLED,
      },
    });

    const matching = automations.filter((a) => a.currentVersionId != null);
    if (!matching.length) return;

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

    const triggerConfig = version.trigger as { type?: string };
    if (triggerConfig?.type !== event.type) return;

    // Loop detection
    const loopDetected = await this.checkLoop(event.workspaceId, automation.id);
    if (loopDetected) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'automation_loop_detected',
          automationId: automation.id,
          workspaceId: event.workspaceId,
          threshold: LOOP_THRESHOLD,
        }),
      );
      return;
    }

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

    await this.queue.add(
      AUTOMATION_JOB_TYPE,
      { runId: run.id },
      { attempts: 1, removeOnComplete: true, removeOnFail: false },
    );

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

  /**
   * Returns cached kill-switch + cap config. DB read at most once per 30 s per workspace.
   */
  private async resolveWorkspaceConfig(workspaceId: string): Promise<{ enabled: boolean; cap: number }> {
    const cached = this.killSwitchCache.get(workspaceId);
    if (cached && Date.now() < cached.expiresAt) {
      return { enabled: cached.enabled, cap: cached.cap };
    }

    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
      select: ['id', 'automationsEnabled', 'automationConcurrencyCap'],
    });

    const enabled = workspace?.automationsEnabled ?? true;
    const cap = workspace?.automationConcurrencyCap ?? DEFAULT_CONCURRENCY_CAP;

    this.killSwitchCache.set(workspaceId, {
      enabled,
      cap,
      expiresAt: Date.now() + KILL_SWITCH_CACHE_TTL_MS,
    });

    return { enabled, cap };
  }

  /**
   * Loop detection via Redis sorted set.
   * Records current timestamp as score; trims entries older than LOOP_WINDOW_MS.
   * Returns true if fire count within window exceeds LOOP_THRESHOLD.
   * Fails open on Redis unavailability.
   */
  private async checkLoop(workspaceId: string, automationId: string): Promise<boolean> {
    try {
      const redis = await this.queue.client;
      const key = `automation:loop:${workspaceId}:${automationId}`;
      const now = Date.now();
      const windowStart = now - LOOP_WINDOW_MS;

      const pipeline = redis.pipeline();
      pipeline.zadd(key, now, `${now}-${String(Math.random()).slice(2)}`);
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      pipeline.zcard(key);
      pipeline.expire(key, Math.ceil(LOOP_WINDOW_MS / 1000) * 2);

      const results = await pipeline.exec();
      const count = (results?.[2]?.[1] as number) ?? 0;

      return count > LOOP_THRESHOLD;
    } catch (err: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'automation_loop_check_failed',
          automationId,
          workspaceId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return false;
    }
  }
}
