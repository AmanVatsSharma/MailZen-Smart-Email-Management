import { Module } from '@nestjs/common';
import { EmailProviderService } from './email-provider.service';
import { EmailProviderResolver } from './email-provider.resolver';
import { EmailProviderConnectResolver } from './email-provider.connect.resolver';
import { ProviderOAuthController } from './provider-oauth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GmailSyncModule } from '../gmail-sync/gmail-sync.module';

@Module({
  imports: [PrismaModule, GmailSyncModule],
  controllers: [ProviderOAuthController],
  providers: [EmailProviderService, EmailProviderResolver, EmailProviderConnectResolver],
  exports: [EmailProviderService],
})
export class EmailProviderModule {} 