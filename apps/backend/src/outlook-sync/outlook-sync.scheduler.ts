import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { NotificationService } from '../notification/notification.service';
import { OutlookSyncService } from './outlook-sync.service';

@Injectable()
export class OutlookSyncScheduler {
  private readonly logger = new Logger(OutlookSyncScheduler.name);

  constructor(
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepo: Repository<EmailProvider>,
    private readonly outlookSync: OutlookSyncService,
    private readonly notificationService: NotificationService,
  ) {}

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
      try {
        await this.outlookSync.syncOutlookProvider(
          provider.id,
          provider.userId,
          25,
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Cron Outlook sync failed provider=${provider.id}: ${message}`,
        );
        await this.emailProviderRepo.update(
          { id: provider.id },
          { status: 'error' },
        );
        await this.notificationService.createNotification({
          userId: provider.userId,
          type: 'SYNC_FAILED',
          title: 'Outlook sync failed',
          message:
            'MailZen failed to sync your Outlook account. We will retry automatically.',
          metadata: { providerId: provider.id, providerType: 'OUTLOOK' },
        });
      }
    }
  }
}
