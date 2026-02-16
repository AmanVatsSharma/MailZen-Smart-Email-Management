import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiAgentGatewayService } from './ai-agent-gateway.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

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
    const runCorrelationId = resolveCorrelationId(undefined);
    if (!this.isAutoPurgeEnabled()) {
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_action_audit_retention_autopurge_disabled',
          runCorrelationId,
        }),
      );
      return;
    }

    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_action_audit_retention_autopurge_start',
          runCorrelationId,
        }),
      );
      const result =
        await this.aiAgentGatewayService.purgeAgentActionAuditRetentionData({});
      this.logger.log(
        serializeStructuredLog({
          event: 'agent_action_audit_retention_autopurge_completed',
          runCorrelationId,
          deletedRows: result.deletedRows,
          retentionDays: result.retentionDays,
          userScoped: result.userScoped,
          executedAtIso: result.executedAtIso,
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        serializeStructuredLog({
          event: 'agent_action_audit_retention_autopurge_failed',
          runCorrelationId,
          error: message,
        }),
      );
    }
  }
}
