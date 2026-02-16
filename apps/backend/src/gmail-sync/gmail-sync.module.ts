import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { GmailSyncService } from './gmail-sync.service';
import { GmailSyncResolver } from './gmail-sync.resolver';
import { GmailSyncScheduler } from './gmail-sync.scheduler';
import { GmailSyncWebhookController } from './gmail-sync-webhook.controller';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailProvider,
      ExternalEmailLabel,
      ExternalEmailMessage,
      AuditLog,
    ]),
    NotificationModule,
  ],
  controllers: [GmailSyncWebhookController],
  providers: [
    GmailSyncService,
    GmailSyncResolver,
    GmailSyncScheduler,
    ProviderSyncLeaseService,
  ],
  exports: [GmailSyncService],
})
export class GmailSyncModule {}
