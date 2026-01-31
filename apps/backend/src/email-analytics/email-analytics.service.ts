import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailAnalytics } from './email-analytics.entity';
import { CreateEmailAnalyticsInput } from './dto/create-email-analytics.input';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEmailAnalytics(userId: string, input: CreateEmailAnalyticsInput): Promise<EmailAnalytics> {
    // Ownership: analytics is scoped to an internal Email record owned by user.
    const email = await this.prisma.email.findFirst({ where: { id: input.emailId, userId } });
    if (!email) throw new NotFoundException('Email not found');

    const rec = await this.prisma.emailAnalytics.upsert({
      where: { emailId: input.emailId },
      create: {
        emailId: input.emailId,
        openCount: input.openCount ?? 0,
        clickCount: input.clickCount ?? 0,
      },
      update: {
        openCount: input.openCount ?? 0,
        clickCount: input.clickCount ?? 0,
      },
    });

    return {
      id: rec.id,
      emailId: rec.emailId,
      openCount: rec.openCount,
      clickCount: rec.clickCount,
      lastUpdatedAt: rec.updatedAt,
    };
  }

  async getAllEmailAnalytics(userId: string): Promise<EmailAnalytics[]> {
    const recs = await this.prisma.emailAnalytics.findMany({
      where: { email: { userId } },
      orderBy: { updatedAt: 'desc' },
    });
    return recs.map(r => ({
      id: r.id,
      emailId: r.emailId,
      openCount: r.openCount,
      clickCount: r.clickCount,
      lastUpdatedAt: r.updatedAt,
    }));
  }

  // Additional methods (update, delete) can be added as needed.
} 