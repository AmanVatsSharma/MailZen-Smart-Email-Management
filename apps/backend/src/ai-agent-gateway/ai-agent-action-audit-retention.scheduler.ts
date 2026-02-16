import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiAgentGatewayService } from './ai-agent-gateway.service';

@Injectable()
export class AiAgentActionAuditRetentionScheduler {
  private readonly logger = new Logger(
    AiAgentActionAuditRetentionScheduler.name,
  );

  constructor(private readonly aiAgentGatewayService: AiAgentGatewayService) {}

  private isAutoPurgeEnabled(): boolean {
    const normalized = String(
      process.env.AI_AGENT_ACTION_AUDIT_AUTOPURGE_ENABLED || 'true',
    )
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredAgentActionAudits(): Promise<void> {
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log('agent-action-audit: auto-purge disabled by env');
      return;
    }

    try {
      const result =
        await this.aiAgentGatewayService.purgeAgentActionAuditRetentionData({});
      this.logger.log(
        `agent-action-audit: purged rows=${result.deletedRows} retentionDays=${result.retentionDays}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`agent-action-audit: purge failed: ${message}`);
    }
  }
}
