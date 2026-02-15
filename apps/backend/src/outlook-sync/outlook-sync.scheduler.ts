import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { OutlookSyncService } from './outlook-sync.service';

@Injectable()
export class OutlookSyncScheduler {
  private readonly logger = new Logger(OutlookSyncScheduler.name);

  constructor(
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepo: Repository<EmailProvider>,
    private readonly outlookSync: OutlookSyncService,
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
      rawValue: process.env.OUTLOOK_SYNC_SCHEDULER_RETRIES,
      fallbackValue: 1,
      minimumValue: 0,
      maximumValue: 5,
    });
  }

  private getRetryBackoffMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.OUTLOOK_SYNC_SCHEDULER_RETRY_BACKOFF_MS,
      fallbackValue: 250,
      minimumValue: 50,
      maximumValue: 15_000,
    });
  }

  private getMaxJitterMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.OUTLOOK_SYNC_SCHEDULER_JITTER_MS,
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
        await this.outlookSync.syncOutlookProvider(
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
          `Cron Outlook sync retry provider=${input.provider.id} attempt=${attempt + 1} error=${message}`,
        );
        await this.sleep(backoffBaseMs * (attempt + 1));
      }
    }
    return {
      success: false,
      attempts: maxRetries + 1,
      error: new Error('Outlook sync retry loop exhausted unexpectedly'),
    };
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncActiveOutlookProviders() {
    const providers: EmailProvider[] = await this.emailProviderRepo.find({
      where: { type: 'OUTLOOK', isActive: true },
    });
    if (!providers.length) return;

    this.logger.log(
      `Cron: syncing ${providers.length} active Outlook providers`,
    );

    for (const provider of providers) {
      const leaseAcquired = await this.providerSyncLease.acquireProviderSyncLease(
        {
          providerId: provider.id,
          providerType: 'OUTLOOK',
        },
      );
      if (!leaseAcquired) continue;

      const maxJitterMs = this.getMaxJitterMs();
      if (maxJitterMs > 0) {
        const jitterMs = Math.floor(Math.random() * (maxJitterMs + 1));
        await this.sleep(jitterMs);
      }

      const syncResult = await this.syncProviderWithRetry({ provider });
      if (syncResult.success) continue;

      try {
        const message =
          syncResult.error instanceof Error
            ? syncResult.error.message
            : String(syncResult.error);
        this.logger.warn(
          `Cron Outlook sync failed provider=${provider.id}: ${message}`,
        );
        await this.emailProviderRepo.update(
          { id: provider.id },
          {
            status: 'error',
            syncLeaseExpiresAt: null,
            lastSyncError: message.slice(0, 500),
            lastSyncErrorAt: new Date(),
          },
        );
        await this.notificationEventBus.publishSafely({
          userId: provider.userId,
          type: 'SYNC_FAILED',
          title: 'Outlook sync failed',
          message:
            'MailZen failed to sync your Outlook account. We will retry automatically.',
          metadata: {
            providerId: provider.id,
            providerType: 'OUTLOOK',
            workspaceId: provider.workspaceId || null,
            attempts: syncResult.attempts,
            error: message.slice(0, 240),
          },
        });
      } catch (notificationError: unknown) {
        const notificationMessage =
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError);
        this.logger.warn(
          `Cron Outlook sync failure handling failed provider=${provider.id}: ${notificationMessage}`,
        );
      }
    }
  }
}
