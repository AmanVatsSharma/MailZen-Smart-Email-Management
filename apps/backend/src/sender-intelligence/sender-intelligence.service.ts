/**
 * SenderIntelligenceService
 *
 * Builds and maintains per-sender profiles from email history.
 * Profiles drive:
 *  - VIP Sender Fast-lane (priority inbox elevation)
 *  - "Your busiest sender" analytics card on Dashboard
 *  - Relationship score displayed in EmailDetail header
 *
 * Phase 6 of the MailZen AI roadmap.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SenderProfile } from './entities/sender-profile.entity';

export interface UpsertSenderInput {
  userId: string;
  senderEmail: string;
  displayName?: string;
  emailReceivedAt?: Date;
  topics?: string[];
  userRepliedAt?: Date;
}

@Injectable()
export class SenderIntelligenceService {
  private readonly logger = new Logger(SenderIntelligenceService.name);

  constructor(
    @InjectRepository(SenderProfile)
    private readonly profileRepo: Repository<SenderProfile>,
  ) {}

  /** Upsert profile on each inbound email event. */
  async recordInboundEmail(input: UpsertSenderInput): Promise<SenderProfile> {
    const domain = this.extractDomain(input.senderEmail);
    let profile = await this.profileRepo.findOne({
      where: { userId: input.userId, senderEmail: input.senderEmail },
    });

    if (!profile) {
      profile = this.profileRepo.create({
        userId: input.userId,
        senderEmail: input.senderEmail,
        displayName: input.displayName ?? null,
        domain,
        emailCount: 0,
        relationshipScore: 0,
        topics: [],
        isVip: false,
      });
    }

    profile.emailCount += 1;
    if (input.displayName && !profile.displayName) {
      profile.displayName = input.displayName;
    }
    if (input.emailReceivedAt) {
      profile.lastEmailAt = input.emailReceivedAt;
    }
    if (input.topics?.length) {
      // Merge topics — keep top 10 by frequency
      const merged = [...new Set([...profile.topics, ...input.topics])].slice(0, 10);
      profile.topics = merged;
    }

    profile.relationshipScore = this.computeRelationshipScore(profile);
    return this.profileRepo.save(profile);
  }

  /** Record user-replied signal to update avg response time. */
  async recordReply(
    userId: string,
    senderEmail: string,
    repliedAt: Date,
    originalReceivedAt: Date,
  ): Promise<void> {
    const profile = await this.profileRepo.findOne({
      where: { userId, senderEmail },
    });
    if (!profile) return;

    const responseSec = (repliedAt.getTime() - originalReceivedAt.getTime()) / 1000;
    if (profile.avgResponseTimeSec == null) {
      profile.avgResponseTimeSec = responseSec;
    } else {
      // Exponential moving average (α = 0.3)
      profile.avgResponseTimeSec = 0.7 * profile.avgResponseTimeSec + 0.3 * responseSec;
    }
    profile.relationshipScore = this.computeRelationshipScore(profile);
    await this.profileRepo.save(profile);
  }

  /** Retrieve a sender profile for display in EmailDetail / Contact cards. */
  async getSenderProfile(
    userId: string,
    senderEmail: string,
  ): Promise<SenderProfile | null> {
    return this.profileRepo.findOne({ where: { userId, senderEmail } }) ?? null;
  }

  /** Top N senders by email volume for analytics dashboard. */
  async getTopSenders(userId: string, limit = 10): Promise<SenderProfile[]> {
    return this.profileRepo.find({
      where: { userId },
      order: { emailCount: 'DESC' },
      take: limit,
    });
  }

  /** VIP senders (manual flag or high relationship score ≥ 0.8). */
  async getVipSenders(userId: string): Promise<SenderProfile[]> {
    return this.profileRepo
      .createQueryBuilder('sp')
      .where('sp.userId = :userId', { userId })
      .andWhere('(sp.isVip = true OR sp.relationshipScore >= 0.8)')
      .orderBy('sp.relationshipScore', 'DESC')
      .getMany();
  }

  /** Toggle the manual VIP flag. */
  async setVip(userId: string, senderEmail: string, isVip: boolean): Promise<SenderProfile | null> {
    const profile = await this.profileRepo.findOne({ where: { userId, senderEmail } });
    if (!profile) return null;
    profile.isVip = isVip;
    return this.profileRepo.save(profile);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private extractDomain(email: string): string {
    const parts = email.split('@');
    return parts.length === 2 ? parts[1].toLowerCase() : '';
  }

  /**
   * Composite relationship score (0–1).
   *
   * Factors:
   * - Volume (log-scaled): frequent senders get a higher base
   * - Fast response: shorter avg reply time → higher score
   * - Topics variety: more topics = more engaged relationship
   */
  private computeRelationshipScore(profile: SenderProfile): number {
    const volumeScore = Math.min(Math.log10(profile.emailCount + 1) / 3, 1);

    let responseScore = 0;
    if (profile.avgResponseTimeSec != null) {
      // <1h = 1.0, <4h = 0.7, <24h = 0.4, else 0
      const hours = profile.avgResponseTimeSec / 3600;
      responseScore = hours < 1 ? 1 : hours < 4 ? 0.7 : hours < 24 ? 0.4 : 0.1;
    }

    const topicScore = Math.min(profile.topics.length / 10, 1);

    const raw = volumeScore * 0.5 + responseScore * 0.35 + topicScore * 0.15;
    return Math.round(raw * 100) / 100;
  }
}
