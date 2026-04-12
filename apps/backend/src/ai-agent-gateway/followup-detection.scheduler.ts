/**
 * File: apps/backend/src/ai-agent-gateway/followup-detection.scheduler.ts
 * Purpose: Daily scheduler that detects stale sent emails needing follow-up
 *          and creates actionable notifications for users.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { LessThan, Repository } from 'typeorm';
import { Email } from '../email/entities/email.entity';
import { User } from '../user/entities/user.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { randomUUID } from 'crypto';

const FOLLOWUP_STALE_DAYS = parseInt(
  process.env.FOLLOWUP_STALE_DAYS ?? '3',
  10,
);
const FOLLOWUP_BATCH_SIZE = parseInt(
  process.env.FOLLOWUP_BATCH_SIZE ?? '20',
  10,
);

@Injectable()
export class FollowupDetectionScheduler {
  private readonly logger = new Logger(FollowupDetectionScheduler.name);

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  /** Runs daily at 8 AM UTC */
  @Cron('0 8 * * *')
  async detectStaleFollowups(): Promise<void> {
    const agentUrl = process.env.AI_AGENT_PLATFORM_URL;
    if (!agentUrl) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'followup_detection_skipped',
          reason: 'AI_AGENT_PLATFORM_URL not configured',
        }),
      );
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - FOLLOWUP_STALE_DAYS);

    let processed = 0;
    let notified = 0;

    try {
      // Find sent emails older than threshold with no recent update
      const staleEmails = await this.emailRepo.find({
        where: { status: 'SENT', updatedAt: LessThan(cutoffDate) },
        relations: ['user'],
        take: FOLLOWUP_BATCH_SIZE,
        order: { updatedAt: 'ASC' },
      });

      for (const email of staleEmails) {
        if (!email.user) continue;
        processed++;

        const daysSince = Math.floor(
          (Date.now() - email.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        try {
          const payload = {
            version: 'v1',
            skill: 'followup',
            requestId: randomUUID(),
            messages: [
              {
                role: 'user',
                content: `Check if follow-up is needed for email: ${email.subject}`,
              },
            ],
            context: {
              surface: 'scheduler',
              locale: 'en-US',
              email: email.user.email ?? null,
              metadata: {
                threadId: email.id,
                emailSubject: email.subject,
                emailTo: Array.isArray(email.to) ? email.to[0] : '',
                sentAt: email.createdAt.toISOString(),
                daysUnanswered: String(daysSince),
                priority: 'normal',
              },
            },
            allowedActions: ['followup.detect'],
            requestedAction: null,
            requestedActionPayload: {},
          };

          const response = await axios.post(
            `${agentUrl}/v1/agent/respond`,
            payload,
            { timeout: 8000 },
          );

          const agentResponse = response.data;
          const needsFollowup = agentResponse?.suggestedActions?.some(
            (a: { name: string }) => a.name === 'followup.schedule_send',
          );

          if (needsFollowup) {
            await this.notificationEventBus.publishSafely({
              userId: email.userId,
              type: 'FOLLOWUP_REMINDER',
              title: 'Follow-up reminder',
              message: `No reply received for "${email.subject}" (${daysSince} days ago). Consider sending a follow-up.`,
              metadata: {
                emailId: email.id,
                subject: email.subject,
                daysSince,
                agentText: agentResponse?.assistantText ?? '',
              },
            });
            notified++;
          }
        } catch (innerErr: unknown) {
          this.logger.warn(
            serializeStructuredLog({
              event: 'followup_detection_email_error',
              emailId: email.id,
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
          event: 'followup_detection_complete',
          processed,
          notified,
          cutoffDate: cutoffDate.toISOString(),
        }),
      );
    } catch (err: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'followup_detection_failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
