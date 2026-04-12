/**
 * File: apps/backend/src/ai-agent-gateway/ai-digest.scheduler.ts
 * Purpose: Daily AI email digest — summarizes each user's inbox highlights
 *          and delivers as an in-app notification.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Email } from '../email/entities/email.entity';
import { User } from '../user/entities/user.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { randomUUID } from 'crypto';

const DIGEST_MAX_EMAILS_PER_USER = parseInt(
  process.env.DIGEST_MAX_EMAILS_PER_USER ?? '10',
  10,
);
const DIGEST_MAX_USERS_PER_RUN = parseInt(
  process.env.DIGEST_MAX_USERS_PER_RUN ?? '50',
  10,
);

@Injectable()
export class AiDigestScheduler {
  private readonly logger = new Logger(AiDigestScheduler.name);

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  /** Runs daily at 7 AM UTC */
  @Cron('0 7 * * *')
  async sendDailyDigest(): Promise<void> {
    const agentUrl = process.env.AI_AGENT_PLATFORM_URL;
    if (!agentUrl) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'ai_digest_skipped',
          reason: 'AI_AGENT_PLATFORM_URL not configured',
        }),
      );
      return;
    }

    const since = new Date();
    since.setHours(since.getHours() - 24);

    let usersProcessed = 0;
    let digestsSent = 0;

    try {
      const activeUsers = await this.userRepo.find({
        take: DIGEST_MAX_USERS_PER_RUN,
        order: { createdAt: 'DESC' },
      });

      for (const user of activeUsers) {
        try {
          const recentEmails = await this.emailRepo.find({
            where: {
              userId: user.id,
              createdAt: MoreThanOrEqual(since),
            },
            take: DIGEST_MAX_EMAILS_PER_USER,
            order: { createdAt: 'DESC' },
          });

          if (recentEmails.length === 0) continue;
          usersProcessed++;

          // Build thread context for the coordinator/summarize call
          const emailSummaries = recentEmails
            .map(
              (e, i) =>
                `${i + 1}. From: ${e.from} | Subject: ${e.subject} | ${e.isImportant ? '[IMPORTANT]' : ''}`,
            )
            .join('\n');

          const importantCount = recentEmails.filter(
            (e) => e.isImportant,
          ).length;

          const payload = {
            version: 'v1',
            skill: 'summarize',
            requestId: randomUUID(),
            messages: [
              {
                role: 'user',
                content: `Create a brief daily digest for these ${recentEmails.length} emails received in the last 24 hours.`,
              },
            ],
            context: {
              surface: 'digest',
              locale: 'en-US',
              email: user.email ?? null,
              metadata: {
                subject: `Daily Digest — ${recentEmails.length} emails`,
                emailBody: emailSummaries,
                emailFrom: 'MailZen Digest',
                digestDate: new Date().toISOString(),
                totalEmails: String(recentEmails.length),
                importantEmails: String(importantCount),
              },
            },
            allowedActions: ['summarize.thread', 'summarize.view_summary'],
            requestedAction: null,
            requestedActionPayload: {},
          };

          const response = await axios.post(
            `${agentUrl}/v1/agent/respond`,
            payload,
            { timeout: 12000 },
          );

          const agentResponse = response.data;
          const digestText =
            agentResponse?.assistantText ||
            `You have ${recentEmails.length} new emails (${importantCount} important).`;

          await this.notificationEventBus.publishSafely({
            userId: user.id,
            type: 'AI_DAILY_DIGEST',
            title: `Your daily digest — ${recentEmails.length} emails`,
            message: digestText,
            metadata: {
              emailCount: recentEmails.length,
              importantCount,
              digestDate: new Date().toISOString(),
              agentIntent: agentResponse?.intent ?? 'summarize_thread',
            },
          });

          digestsSent++;
        } catch (innerErr: unknown) {
          this.logger.warn(
            serializeStructuredLog({
              event: 'ai_digest_user_error',
              userId: user.id,
              error:
                innerErr instanceof Error
                  ? innerErr.message
                  : String(innerErr),
            }),
          );
        }
      }

      this.logger.log(
        serializeStructuredLog({
          event: 'ai_digest_complete',
          usersProcessed,
          digestsSent,
          since: since.toISOString(),
        }),
      );
    } catch (err: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'ai_digest_failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
