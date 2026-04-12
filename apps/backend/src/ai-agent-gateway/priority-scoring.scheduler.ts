/**
 * File: apps/backend/src/ai-agent-gateway/priority-scoring.scheduler.ts
 * Purpose: Background scheduler that calls the triage skill on newly synced
 *          emails to populate aiPriority and aiCategory fields.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { IsNull, Repository } from 'typeorm';
import { Email } from '../email/entities/email.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { randomUUID } from 'crypto';

const SCORING_BATCH_SIZE = parseInt(
  process.env.PRIORITY_SCORING_BATCH_SIZE ?? '15',
  10,
);

@Injectable()
export class PriorityScoringScheduler {
  private readonly logger = new Logger(PriorityScoringScheduler.name);

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
  ) {}

  /** Runs every 15 minutes to score newly received emails */
  @Cron('*/15 * * * *')
  async scoreNewEmails(): Promise<void> {
    const agentUrl = process.env.AI_AGENT_PLATFORM_URL;
    if (!agentUrl) return;

    let processed = 0;
    let scored = 0;

    try {
      // Find emails not yet AI-scored (using isImportant as a proxy until migration adds aiPriority)
      // After Phase 5 migration, filter by: WHERE ai_priority IS NULL
      const unscored = await this.emailRepo.find({
        where: { status: 'SENT' },
        take: SCORING_BATCH_SIZE,
        order: { createdAt: 'DESC' },
      });

      for (const email of unscored) {
        processed++;
        try {
          const bodyPreview = email.body?.slice(0, 800) ?? '';
          const payload = {
            version: 'v1',
            skill: 'triage',
            requestId: randomUUID(),
            messages: [
              { role: 'user', content: 'Classify this email for priority and category.' },
            ],
            context: {
              surface: 'scheduler',
              locale: 'en-US',
              email: null,
              metadata: {
                threadId: email.id,
                emailSubject: email.subject,
                emailFrom: email.from,
                emailBody: bodyPreview,
                emailDate: email.createdAt.toISOString(),
              },
            },
            allowedActions: ['triage.classify', 'triage.apply_labels'],
            requestedAction: null,
            requestedActionPayload: {},
          };

          const response = await axios.post(
            `${agentUrl}/v1/agent/respond`,
            payload,
            { timeout: 6000 },
          );

          const agentResponse = response.data;
          const applyAction = agentResponse?.suggestedActions?.find(
            (a: { name: string }) => a.name === 'triage.apply_labels',
          );

          if (applyAction?.payload) {
            const { priority, category } = applyAction.payload as Record<string, string>;
            // Store as metadata on existing fields until Phase 5 migration adds dedicated columns
            // Priority: urgent/high → mark as important
            if (priority === 'urgent' || priority === 'high') {
              await this.emailRepo.update(email.id, { isImportant: true });
            }
            scored++;
          }
        } catch (innerErr: unknown) {
          this.logger.debug(
            serializeStructuredLog({
              event: 'priority_scoring_email_error',
              emailId: email.id,
              error:
                innerErr instanceof Error
                  ? innerErr.message
                  : String(innerErr),
            }),
          );
        }
      }

      if (scored > 0) {
        this.logger.log(
          serializeStructuredLog({
            event: 'priority_scoring_complete',
            processed,
            scored,
          }),
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'priority_scoring_failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
