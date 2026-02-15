import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderService } from './email-provider.service';
import { EmailProviderResolver } from './email-provider.resolver';
import { ProviderOAuthController } from './provider-oauth.controller';
import { EmailProviderConnectResolver } from './email-provider.connect.resolver';
import { GmailSyncModule } from '../gmail-sync/gmail-sync.module';
import { OutlookSyncModule } from '../outlook-sync/outlook-sync.module';

/**
 * EmailProviderModule - External email provider integration
 * Manages Gmail, Outlook, and SMTP provider connections
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EmailProvider]),
    GmailSyncModule,
    OutlookSyncModule,
  ],
  controllers: [ProviderOAuthController],
  providers: [
    EmailProviderService,
    EmailProviderResolver,
    EmailProviderConnectResolver,
  ],
  exports: [EmailProviderService],
})
export class EmailProviderModule {}
