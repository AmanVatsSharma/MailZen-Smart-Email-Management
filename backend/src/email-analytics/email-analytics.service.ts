import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailAnalytics } from './email-analytics.entity';
import { CreateEmailAnalyticsInput } from './dto/create-email-analytics.input';

@Injectable()
export class EmailAnalyticsService {
  private analytics: EmailAnalytics[] = [];
  private idCounter = 1;

  createEmailAnalytics(input: CreateEmailAnalyticsInput): EmailAnalytics {
    const record: EmailAnalytics = {
      id: String(this.idCounter++),
      emailId: input.emailId,
      openCount: input.openCount,
      clickCount: input.clickCount,
      lastUpdatedAt: input.lastUpdatedAt,
    };
    this.analytics.push(record);
    return record;
  }

  getAllEmailAnalytics(): EmailAnalytics[] {
    return this.analytics;
  }

  // Additional methods (update, delete) can be added as needed.
} 