import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailProvider } from './entities/email-provider.entity';
import { EmailProviderService } from './email-provider.service';
import { EmailProviderResolver } from './email-provider.resolver';
import { EmailProviderController } from './email-provider.controller';

/**
 * EmailProviderModule - External email provider integration
 * Manages Gmail, Outlook, and SMTP provider connections
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EmailProvider]),
  ],
  controllers: [EmailProviderController],
  providers: [EmailProviderService, EmailProviderResolver],
  exports: [EmailProviderService],
})
export class EmailProviderModule {}
