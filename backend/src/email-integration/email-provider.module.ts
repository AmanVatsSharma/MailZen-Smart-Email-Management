import { Module } from '@nestjs/common';
import { EmailProviderService } from './email-provider.service';
import { EmailProviderResolver } from './email-provider.resolver';
// Prisma removed

@Module({
  imports: [],
  providers: [EmailProviderService, EmailProviderResolver],
  exports: [EmailProviderService],
})
export class EmailProviderModule {} 