import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GmailSyncService } from './gmail-sync.service';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';

/**
 * Periodic Gmail sync.
 *
 * MVP: sync all active Gmail providers every 10 minutes.
 * This is intentionally conservative to avoid rate-limit surprises.
 */
@Injectable()
export class GmailSyncScheduler {
  private readonly logger = new Logger(GmailSyncScheduler.name);

  constructor(
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepo: Repository<EmailProvider>,
    private readonly gmailSync: GmailSyncService,
    private readonly providerSyncLease: ProviderSyncLeaseService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  private resolveIntegerEnv(input: {
    rawValue: string | undefined;
    fallbackValue: number;
    minimumValue: number;
    maximumValue: number;
  }): number {
    const parsed = Number(input.rawValue);
    const normalized = Number.isFinite(parsed)
      ? Math.floor(parsed)
      : input.fallbackValue;
    if (normalized < input.minimumValue) return input.minimumValue;
    if (normalized > input.maximumValue) return input.maximumValue;
    return normalized;
  }

  private getMaxRetries(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.GMAIL_SYNC_SCHEDULER_RETRIES,
      fallbackValue: 1,
      minimumValue: 0,
      maximumValue: 5,
    });
  }

  private getRetryBackoffMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.GMAIL_SYNC_SCHEDULER_RETRY_BACKOFF_MS,
      fallbackValue: 250,
      minimumValue: 50,
      maximumValue: 15_000,
    });
  }

  private getMaxJitterMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.GMAIL_SYNC_SCHEDULER_JITTER_MS,
      fallbackValue: 150,
      minimumValue: 0,
      maximumValue: 10_000,
    });
  }

  private async sleep(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async syncProviderWithRetry(input: {
    provider: EmailProvider;
  }): Promise<
    | { success: true; attempts: number }
    | { success: false; attempts: number; error: unknown }
  > {
    const maxRetries = this.getMaxRetries();
    const backoffBaseMs = this.getRetryBackoffMs();
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await this.gmailSync.syncGmailProvider(
          input.provider.id,
          input.provider.userId,
          25,
        );
        return { success: true, attempts: attempt + 1 };
      } catch (error: unknown) {
        const isLastAttempt = attempt >= maxRetries;
        if (isLastAttempt) {
          return { success: false, attempts: attempt + 1, error };
        }
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Cron sync retry provider=${input.provider.id} attempt=${attempt + 1} error=${message}`,
        );
        await this.sleep(backoffBaseMs * (attempt + 1));
      }
    }
    return {
      success: false,
      attempts: maxRetries + 1,
      error: new Error('Gmail sync retry loop exhausted unexpectedly'),
    };
  }

  private isPushWatchEnabled(): boolean {
    return Boolean(String(process.env.GMAIL_PUSH_TOPIC_NAME || '').trim());
  }

  private normalizeSyncErrorSignature(value: unknown): string {
    const normalized =
      typeof value === 'string'
        ? value
        : value instanceof Error
          ? value.message
          : value === null || value === undefined
            ? ''
            : JSON.stringify(value);
    return String(normalized).trim().slice(0, 500);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncActiveGmailProviders() {
    const providers: EmailProvider[] = await this.emailProviderRepo.find({
      where: { type: 'GMAIL', isActive: true },
    });
    if (!providers.length) return;

    this.logger.log(`Cron: syncing ${providers.length} active Gmail providers`);

    for (const p of providers) {
      const leaseAcquired =
        await this.providerSyncLease.acquireProviderSyncLease({
          providerId: p.id,
          providerType: 'GMAIL',
        });
      if (!leaseAcquired) continue;

      const maxJitterMs = this.getMaxJitterMs();
      if (maxJitterMs > 0) {
        const jitterMs = Math.floor(Math.random() * (maxJitterMs + 1));
        await this.sleep(jitterMs);
      }

      const syncResult = await this.syncProviderWithRetry({ provider: p });
      if (syncResult.success) {
        if (String(p.lastSyncError || '').trim()) {
          await this.notificationEventBus.publishSafely({
            userId: p.userId,
            type: 'SYNC_RECOVERED',
            title: 'Gmail sync recovered',
            message:
              'MailZen has recovered Gmail synchronization for your account.',
            metadata: {
              providerId: p.id,
              providerType: 'GMAIL',
              workspaceId: p.workspaceId || null,
            },
          });
        }
        continue;
      }

      try {
        const message =
          syncResult.error instanceof Error
            ? syncResult.error.message
            : String(syncResult.error);
        const normalizedErrorMessage =
          this.normalizeSyncErrorSignature(message);
        const previousErrorMessage = this.normalizeSyncErrorSignature(
          p.lastSyncError,
        );
        this.logger.warn(`Cron sync failed for provider=${p.id}: ${message}`);
        await this.emailProviderRepo.update(
          { id: p.id },
          {
            status: 'error',
            syncLeaseExpiresAt: null,
            lastSyncError: normalizedErrorMessage,
            lastSyncErrorAt: new Date(),
          },
        );
        if (normalizedErrorMessage === previousErrorMessage) {
          continue;
        }
        await this.notificationEventBus.publishSafely({
          userId: p.userId,
          type: 'SYNC_FAILED',
          title: 'Gmail sync failed',
          message:
            'MailZen failed to sync your Gmail account. We will retry automatically.',
          metadata: {
            providerId: p.id,
            providerType: 'GMAIL',
            workspaceId: p.workspaceId || null,
            attempts: syncResult.attempts,
            error: normalizedErrorMessage.slice(0, 240),
          },
        });
      } catch (notificationError: unknown) {
        const notificationMessage =
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError);
        this.logger.warn(
          `Cron sync failure handling failed for provider=${p.id}: ${notificationMessage}`,
        );
      }
    }
  }

  @Cron('15 */6 * * *')
  async refreshGmailPushWatches() {
    if (!this.isPushWatchEnabled()) return;
    const providers: EmailProvider[] = await this.emailProviderRepo.find({
      where: { type: 'GMAIL', isActive: true },
    });
    if (!providers.length) return;

    this.logger.log(
      `Cron: refreshing Gmail push watches for ${providers.length} providers`,
    );

    for (const provider of providers) {
      const leaseAcquired =
        await this.providerSyncLease.acquireProviderSyncLease({
          providerId: provider.id,
          providerType: 'GMAIL',
        });
      if (!leaseAcquired) continue;

      try {
        await this.gmailSync.ensurePushWatchForProvider(
          provider.id,
          provider.userId,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Cron push watch refresh failed provider=${provider.id}: ${message}`,
        );
      }
    }
  }
}
