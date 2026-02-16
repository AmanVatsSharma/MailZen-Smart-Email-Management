import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiAgentGatewayService } from './ai-agent-gateway.service';

@Injectable()
export class AiAgentPlatformHealthSampleRetentionScheduler {
  private readonly logger = new Logger(
    AiAgentPlatformHealthSampleRetentionScheduler.name,
  );

  constructor(private readonly aiAgentGatewayService: AiAgentGatewayService) {}

  private isAutoPurgeEnabled(): boolean {
    const normalized = String(
      process.env.AI_AGENT_HEALTH_SAMPLE_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpiredHealthSamples(): Promise<void> {
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log(
        'agent-platform-health-sample: auto-purge disabled by env',
      );
      return;
    }

    try {
      const result =
        await this.aiAgentGatewayService.purgePlatformHealthSampleRetentionData(
          {},
        );
      this.logger.log(
        `agent-platform-health-sample: purged rows=${result.deletedSamples} retentionDays=${result.retentionDays}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `agent-platform-health-sample: purge failed: ${message}`,
      );
    }
  }
}
