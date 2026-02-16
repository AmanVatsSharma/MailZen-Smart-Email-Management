import { Args, Context, Mutation, Query, Resolver, Int } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { InboxMessage } from './entities/inbox-message.entity';
import { GmailSyncService } from './gmail-sync.service';

interface RequestContext {
  req: {
    user: {
      id: string;
    };
  };
}

@Resolver(() => InboxMessage)
@UseGuards(JwtAuthGuard)
export class GmailSyncResolver {
  private readonly logger = new Logger(GmailSyncResolver.name);

  constructor(
    private readonly gmailSyncService: GmailSyncService,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
  }

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepo.create({
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
      });
      await this.auditLogRepo.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'gmail_sync_resolver_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: this.resolveErrorMessage(error),
        }),
      );
    }
  }

  @Mutation(() => Boolean)
  async syncGmailProvider(
    @Args('providerId') providerId: string,
    @Args('maxMessages', { type: () => Int, nullable: true })
    maxMessages: number,
    @Context() ctx: RequestContext,
  ) {
    const normalizedMaxMessages = maxMessages ?? 25;
    try {
      const syncResult = await this.gmailSyncService.syncGmailProvider(
        providerId,
        ctx.req.user.id,
        normalizedMaxMessages,
      );
      await this.writeAuditLog({
        userId: ctx.req.user.id,
        action: 'gmail_sync_requested',
        metadata: {
          providerId,
          maxMessages: normalizedMaxMessages,
          importedMessages: syncResult.imported,
        },
      });
      return true;
    } catch (error) {
      await this.writeAuditLog({
        userId: ctx.req.user.id,
        action: 'gmail_sync_request_failed',
        metadata: {
          providerId,
          maxMessages: normalizedMaxMessages,
          error: this.resolveErrorMessage(error),
        },
      });
      throw error;
    }
  }

  @Query(() => [InboxMessage])
  async getInboxMessages(
    @Args('inboxType', { type: () => String }) inboxType: string,
    @Args('inboxId') inboxId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit: number,
    @Args('offset', { type: () => Int, nullable: true }) offset: number,
    @Context() ctx: RequestContext,
  ) {
    // MVP: only PROVIDER is supported (Gmail messages live in ExternalEmailMessage).
    if (inboxType !== 'PROVIDER') return [];
    return this.gmailSyncService.listInboxMessagesForProvider(
      inboxId,
      ctx.req.user.id,
      limit ?? 50,
      offset ?? 0,
    );
  }
}
