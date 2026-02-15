import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailSyncService } from './gmail-sync.service';
import { GmailSyncResolver } from './gmail-sync.resolver';
import { GmailSyncScheduler } from './gmail-sync.scheduler';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailProvider,
      ExternalEmailLabel,
      ExternalEmailMessage,
    ]),
    NotificationModule,
  ],
  providers: [GmailSyncService, GmailSyncResolver, GmailSyncScheduler],
  exports: [GmailSyncService],
})
export class GmailSyncModule {}
