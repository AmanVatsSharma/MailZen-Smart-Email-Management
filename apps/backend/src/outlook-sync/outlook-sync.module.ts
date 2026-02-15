import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';
import { NotificationModule } from '../notification/notification.module';
import { OutlookSyncScheduler } from './outlook-sync.scheduler';
import { OutlookSyncService } from './outlook-sync.service';
import { OutlookSyncWebhookController } from './outlook-sync-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailProvider,
      ExternalEmailLabel,
      ExternalEmailMessage,
    ]),
    NotificationModule,
  ],
  controllers: [OutlookSyncWebhookController],
  providers: [
    OutlookSyncService,
    OutlookSyncScheduler,
    ProviderSyncLeaseService,
  ],
  exports: [OutlookSyncService],
})
export class OutlookSyncModule {}
