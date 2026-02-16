import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiAgentPlatformHealthAlertScheduler } from './ai-agent-platform-health-alert.scheduler';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class AiAgentPlatformHealthAlertRunRetentionScheduler {
  private readonly logger = new Logger(
    AiAgentPlatformHealthAlertRunRetentionScheduler.name,
  );

  constructor(
    private readonly healthAlertScheduler: AiAgentPlatformHealthAlertScheduler,
  ) {}

  private isAutoPurgeEnabled(): boolean {
    const normalized = String(
      process.env.AI_AGENT_HEALTH_ALERT_RUN_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async purgeExpiredAlertRuns(): Promise<void> {
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_platform_alert_run_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      return;
    }
    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_platform_alert_run_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result = await this.healthAlertScheduler.purgeAlertRunRetentionData(
        {},
      );
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_platform_alert_run_retention_autopurge_completed',
          runCorrelationId,
          deletedRuns: result.deletedRuns,
          retentionDays: result.retentionDays,
          executedAtIso: result.executedAtIso,
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'agent_platform_alert_run_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
