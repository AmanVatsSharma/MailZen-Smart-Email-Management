/**
 * AiFeedbackService — tracks user signals on AI-generated content.
 *
 * Signals are used to adapt future prompts via `context.metadata.userPreferences`
 * forwarded to the Python agent platform.
 *
 * Phase 7 of the MailZen AI roadmap.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiFeedback, AiFeedbackSignal } from '../entities/ai-feedback.entity';

export interface RecordFeedbackInput {
  userId: string;
  agentSkill: string;
  action: string;
  signal: AiFeedbackSignal;
  emailId?: string;
  draftText?: string;
}

export interface UserPreferenceSummary {
  dominantTone?: string;
  preferredLength?: string;
  acceptRate: number;
  totalSignals: number;
  skillPreferences: Record<string, { acceptRate: number; count: number }>;
}

@Injectable()
export class AiFeedbackService {
  private readonly logger = new Logger(AiFeedbackService.name);

  constructor(
    @InjectRepository(AiFeedback)
    private readonly feedbackRepo: Repository<AiFeedback>,
  ) {}

  /** Record a single feedback signal from the user. */
  async recordFeedback(input: RecordFeedbackInput): Promise<AiFeedback> {
    const entry = this.feedbackRepo.create({
      userId: input.userId,
      agentSkill: input.agentSkill,
      action: input.action,
      signal: input.signal,
      emailId: input.emailId ?? null,
      draftText: input.draftText ?? null,
    });
    const saved = await this.feedbackRepo.save(entry);
    this.logger.debug(
      `Feedback recorded userId=${input.userId} skill=${input.agentSkill} signal=${input.signal}`,
    );
    return saved;
  }

  /**
   * Build a preference summary for a user to inject into agent platform context.
   * Covers the most recent N signals (default 200) to stay responsive to drift.
   */
  async getUserPreferenceSummary(
    userId: string,
    limit = 200,
  ): Promise<UserPreferenceSummary> {
    const rows = await this.feedbackRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    if (rows.length === 0) {
      return {
        acceptRate: 0,
        totalSignals: 0,
        skillPreferences: {},
      };
    }

    const accepts = rows.filter((r) => r.signal === AiFeedbackSignal.ACCEPT).length;
    const acceptRate = accepts / rows.length;

    // Per-skill breakdown
    const bySkill: Record<string, { accepts: number; total: number }> = {};
    for (const row of rows) {
      if (!bySkill[row.agentSkill]) bySkill[row.agentSkill] = { accepts: 0, total: 0 };
      bySkill[row.agentSkill].total++;
      if (row.signal === AiFeedbackSignal.ACCEPT) bySkill[row.agentSkill].accepts++;
    }

    const skillPreferences: Record<string, { acceptRate: number; count: number }> = {};
    for (const [skill, stats] of Object.entries(bySkill)) {
      skillPreferences[skill] = {
        acceptRate: stats.accepts / stats.total,
        count: stats.total,
      };
    }

    return {
      acceptRate,
      totalSignals: rows.length,
      skillPreferences,
    };
  }

  /** Recent signals for a specific skill (used in prompt enrichment). */
  async getRecentSignals(
    userId: string,
    agentSkill: string,
    limit = 20,
  ): Promise<AiFeedback[]> {
    return this.feedbackRepo.find({
      where: { userId, agentSkill },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Purge old feedback beyond retention window (default 90 days). */
  async purgeOldFeedback(retentionDays = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const result = await this.feedbackRepo
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoff', { cutoff })
      .execute();
    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(`Purged ${deleted} old AI feedback records older than ${retentionDays}d`);
    }
    return deleted;
  }
}
