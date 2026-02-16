import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiAgentPlatformHealthAlertScheduler } from './ai-agent-platform-health-alert.scheduler';

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
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log('agent-platform-alert-runs: auto-purge disabled by env');
      return;
    }
    try {
      const result = await this.healthAlertScheduler.purgeAlertRunRetentionData(
        {},
      );
      this.logger.log(
        `agent-platform-alert-runs: purged rows=${result.deletedRuns} retentionDays=${result.retentionDays}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`agent-platform-alert-runs: purge failed: ${message}`);
    }
  }
}
