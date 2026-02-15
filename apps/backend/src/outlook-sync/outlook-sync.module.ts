import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { NotificationModule } from '../notification/notification.module';
import { OutlookSyncScheduler } from './outlook-sync.scheduler';
import { OutlookSyncService } from './outlook-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailProvider,
      ExternalEmailLabel,
      ExternalEmailMessage,
    ]),
    NotificationModule,
  ],
  providers: [OutlookSyncService, OutlookSyncScheduler],
  exports: [OutlookSyncService],
})
export class OutlookSyncModule {}
