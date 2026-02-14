import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailAnalytics } from './entities/email-analytics.entity';
import { EmailAnalyticsService } from './email-analytics.service';
import { EmailAnalyticsResolver } from './email-analytics.resolver';
import { Email } from '../email/entities/email.entity';

/**
 * EmailAnalyticsModule - Email tracking and analytics
 * Handles email open and click tracking
 */
@Module({
  imports: [TypeOrmModule.forFeature([EmailAnalytics, Email])],
  providers: [EmailAnalyticsService, EmailAnalyticsResolver],
  exports: [EmailAnalyticsService],
})
export class EmailAnalyticsModule {}
