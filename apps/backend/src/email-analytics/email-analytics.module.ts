import { Module } from '@nestjs/common';
import { EmailAnalyticsService } from './email-analytics.service';
import { EmailAnalyticsResolver } from './email-analytics.resolver';

@Module({
  providers: [EmailAnalyticsService, EmailAnalyticsResolver],
  exports: [EmailAnalyticsService],
})
export class EmailAnalyticsModule {} 