import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

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
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_platform_health_sample_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      return;
    }

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_platform_health_sample_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result =
        await this.aiAgentGatewayService.purgePlatformHealthSampleRetentionData(
          {},
        );
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_platform_health_sample_retention_autopurge_completed',
          runCorrelationId,
          deletedSamples: result.deletedSamples,
          retentionDays: result.retentionDays,
          executedAtIso: result.executedAtIso,
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'agent_platform_health_sample_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
