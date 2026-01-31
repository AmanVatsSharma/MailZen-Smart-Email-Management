import { Module } from '@nestjs/common';
import { EmailAnalyticsService } from './email-analytics.service';
import { EmailAnalyticsResolver } from './email-analytics.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EmailAnalyticsService, EmailAnalyticsResolver],
  exports: [EmailAnalyticsService],
})
export class EmailAnalyticsModule {} 