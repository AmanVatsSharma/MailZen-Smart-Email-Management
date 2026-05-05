/**
 * File:        apps/backend/src/automation/automation-cron.scheduler.ts
 * Module:      Automation Engine · Cron Scheduler
 * Purpose:     Fires every minute, finds ENABLED automations with a 'schedule.cron' trigger
 *              whose expression is due, and publishes a ScheduleCronEvent into the bus
 *              for each one. The dispatcher then handles condition evaluation + queuing.
 *
 * Exports:
 *   - AutomationCronScheduler  — Injectable NestJS service with @Cron tick
 *
 * Depends on:
 *   - AutomationVersion        — to query active trigger configs
 *   - Automation               — to filter by ENABLED status
 *   - AutomationEventBus       — publish target
 *   - cron-parser              — to determine if expression fires in current minute
 *
 * Side-effects:
 *   - Publishes ScheduleCronEvent into the in-process bus (no DB writes here)
 *
 * Key invariants:
 *   - Only fires for workspace where automations_enabled = true (dispatcher enforces this)
 *   - parseExpression failures are caught and logged — never crash the scheduler
 *   - Tick tolerance: expression is "due" if its prev fire was within the last 90 seconds
 *     (guards against scheduler drift across restarts or cold boots)
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseExpression } from 'cron-parser';
import { Automation, AutomationStatus } from './entities/automation.entity';
import { AutomationVersion } from './entities/automation-version.entity';
import { AutomationEventBus } from './automation-event.bus';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

const TICK_TOLERANCE_MS = 90_000;

@Injectable()
export class AutomationCronScheduler {
  private readonly logger = new Logger(AutomationCronScheduler.name);

  constructor(
    @InjectRepository(Automation)
    private readonly automationRepo: Repository<Automation>,
    @InjectRepository(AutomationVersion)
    private readonly versionRepo: Repository<AutomationVersion>,
    private readonly automationEventBus: AutomationEventBus,
  ) {}

  @Cron('* * * * *')
  async tick(): Promise<void> {
    const now = new Date();

    const enabledAutomations = await this.automationRepo.find({
      where: { status: AutomationStatus.ENABLED },
    });

    const versionIds = enabledAutomations
      .filter((a) => a.currentVersionId)
      .map((a) => a.currentVersionId as string);

    if (!versionIds.length) return;

    const versions = await this.versionRepo
      .createQueryBuilder('v')
      .where('v.id IN (:...ids)', { ids: versionIds })
      .andWhere("v.trigger->>'type' = 'schedule.cron'")
      .getMany();

    for (const version of versions) {
      const automation = enabledAutomations.find((a) => a.currentVersionId === version.id);
      if (!automation) continue;

      const trigger = version.trigger as { type: string; expression?: string; timezone?: string };
      if (!trigger.expression) continue;

      try {
        const interval = parseExpression(trigger.expression, {
          tz: trigger.timezone ?? 'UTC',
          currentDate: now,
        });
        const prev = interval.prev().toDate();
        const msSinceFire = now.getTime() - prev.getTime();

        if (msSinceFire > TICK_TOLERANCE_MS) continue;

        this.automationEventBus.publish({
          type: 'schedule.cron',
          workspaceId: automation.workspaceId,
          userId: automation.createdByUserId,
          automationId: automation.id,
          scheduledAt: prev,
        });

        this.logger.debug(
          serializeStructuredLog({
            event: 'automation_cron_fired',
            automationId: automation.id,
            expression: trigger.expression,
            scheduledAt: prev.toISOString(),
          }),
        );
      } catch (err: unknown) {
        this.logger.warn(
          serializeStructuredLog({
            event: 'automation_cron_parse_error',
            automationId: automation.id,
            expression: trigger.expression,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }
}
