import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailAnalytics } from './email-analytics.entity';
import { CreateEmailAnalyticsInput } from './dto/create-email-analytics.input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailAnalytics as EmailAnalyticsEntity } from './entities/email-analytics.entity';
import { Email } from '../email/entities/email.entity';

@Injectable()
export class EmailAnalyticsService {
  constructor(
    @InjectRepository(EmailAnalyticsEntity)
    private readonly analyticsRepo: Repository<EmailAnalyticsEntity>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
  ) {}

  async createEmailAnalytics(
    userId: string,
    input: CreateEmailAnalyticsInput,
  ): Promise<EmailAnalytics> {
    // Ownership: analytics is scoped to an internal Email record owned by user.
    const email = await this.emailRepo.findOne({
      where: { id: input.emailId, userId },
    });
    if (!email) throw new NotFoundException('Email not found');

    await this.analyticsRepo.upsert(
      [
        {
          emailId: input.emailId,
          openCount: input.openCount ?? 0,
          clickCount: input.clickCount ?? 0,
        },
      ],
      ['emailId'],
    );

    const rec = await this.analyticsRepo.findOne({
      where: { emailId: input.emailId },
    });
    if (!rec)
      throw new NotFoundException('Email analytics not found after upsert');

    return {
      id: rec.id,
      emailId: rec.emailId,
      openCount: rec.openCount,
      clickCount: rec.clickCount,
      lastUpdatedAt: rec.updatedAt,
    };
  }

  async getAllEmailAnalytics(userId: string): Promise<EmailAnalytics[]> {
    const recs = await this.analyticsRepo
      .createQueryBuilder('a')
      .innerJoin('a.email', 'e')
      .where('e.userId = :userId', { userId })
      .orderBy('a.updatedAt', 'DESC')
      .getMany();
    return recs.map((r) => ({
      id: r.id,
      emailId: r.emailId,
      openCount: r.openCount,
      clickCount: r.clickCount,
      lastUpdatedAt: r.updatedAt,
    }));
  }

  // Additional methods (update, delete) can be added as needed.
}
