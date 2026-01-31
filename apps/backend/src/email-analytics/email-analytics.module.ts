import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailAnalytics } from './entities/email-analytics.entity';
import { EmailAnalyticsService } from './email-analytics.service';
import { EmailAnalyticsResolver } from './email-analytics.resolver';

/**
 * EmailAnalyticsModule - Email tracking and analytics
 * Handles email open and click tracking
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EmailAnalytics]),
  ],
  providers: [EmailAnalyticsService, EmailAnalyticsResolver],
  exports: [EmailAnalyticsService],
})
export class EmailAnalyticsModule {}
