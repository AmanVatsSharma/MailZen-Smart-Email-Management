import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { ExternalEmailLabel } from '../email-integration/entities/external-email-label.entity';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { ProviderSyncLeaseService } from '../email-integration/provider-sync-lease.service';
import { NotificationModule } from '../notification/notification.module';
import { EmailAiProcessorModule } from '../email-integration/email-ai-processor.module';
import { OutlookSyncScheduler } from './outlook-sync.scheduler';
import { OutlookSyncService } from './outlook-sync.service';
import { OutlookSyncWebhookController } from './outlook-sync-webhook.controller';
import { SenderIntelligenceModule } from '../sender-intelligence/sender-intelligence.module';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailProvider,
      ExternalEmailLabel,
      ExternalEmailMessage,
      AuditLog,
    ]),
    NotificationModule,
    SenderIntelligenceModule,
    EmailAiProcessorModule,
    AutomationModule,
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
