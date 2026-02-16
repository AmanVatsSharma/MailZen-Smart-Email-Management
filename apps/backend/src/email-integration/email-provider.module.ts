import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderService } from './email-provider.service';
import { EmailProviderResolver } from './email-provider.resolver';
import { ProviderOAuthController } from './provider-oauth.controller';
import { EmailProviderConnectResolver } from './email-provider.connect.resolver';
import { BillingModule } from '../billing/billing.module';
import { GmailSyncModule } from '../gmail-sync/gmail-sync.module';
import { NotificationModule } from '../notification/notification.module';
import { OutlookSyncModule } from '../outlook-sync/outlook-sync.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { ProviderSyncIncidentScheduler } from './provider-sync-incident.scheduler';

/**
 * EmailProviderModule - External email provider integration
 * Manages Gmail, Outlook, and SMTP provider connections
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EmailProvider, UserNotification, AuditLog]),
    BillingModule,
    WorkspaceModule,
    NotificationModule,
    GmailSyncModule,
    OutlookSyncModule,
  ],
  controllers: [ProviderOAuthController],
  providers: [
    EmailProviderService,
    EmailProviderResolver,
    EmailProviderConnectResolver,
    ProviderSyncIncidentScheduler,
  ],
  exports: [EmailProviderService],
})
export class EmailProviderModule {}
