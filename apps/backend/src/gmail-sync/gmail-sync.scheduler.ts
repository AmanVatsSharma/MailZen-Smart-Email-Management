import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GmailSyncService } from './gmail-sync.service';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
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
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncActiveGmailProviders() {
    const providers: EmailProvider[] = await this.emailProviderRepo.find({
      where: { type: 'GMAIL', isActive: true },
    });
    if (!providers.length) return;

    this.logger.log(`Cron: syncing ${providers.length} active Gmail providers`);

    for (const p of providers) {
      try {
        await this.gmailSync.syncGmailProvider(p.id, p.userId, 25);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Cron sync failed for provider=${p.id}: ${message}`);
        await this.emailProviderRepo.update({ id: p.id }, { status: 'error' });
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
          },
        });
      }
    }
  }
}
