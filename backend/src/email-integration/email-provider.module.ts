import { Module } from '@nestjs/common';
import { EmailProviderService } from './email-provider.service';
import { EmailProviderResolver } from './email-provider.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EmailProviderService, EmailProviderResolver],
  exports: [EmailProviderService],
})
export class EmailProviderModule {} 