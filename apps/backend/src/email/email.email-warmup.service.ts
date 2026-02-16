import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from './email.service';
import { StartWarmupInput, PauseWarmupInput } from './dto/warmup.input';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailWarmup } from './entities/email-warmup.entity';
import { WarmupActivity } from './entities/warmup-activity.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class EmailWarmupService {
  private readonly logger = new Logger(EmailWarmupService.name);

  // More diverse subject lines for better deliverability
  private readonly warmupSubjects = [
    'Quick update on our project',
    'Following up on our conversation',
    'Checking in about our meeting',
    'Information you requested',
    'Thoughts on our recent discussion',
    'Important update for you',
    'Quick question about our project',
    'Sharing some resources with you',
    'Feedback on our recent collaboration',
    'Scheduling our next meeting',
    'Weekly progress report',
    'Monthly newsletter',
    'Invitation to our webinar',
    'Thank you for your feedback',
    'New feature announcement',
    'Important security update',
    'Your account summary',
    'Upcoming event details',
    'Product update information',
    'Request for your input',
  ];

  // More diverse email bodies for better deliverability
  private readonly warmupBodies = [
    'Just wanted to follow up on our recent conversation. Looking forward to your thoughts!',
    'I hope this email finds you well. I wanted to share some updates on our project progress.',
    "Thank you for your time during our recent meeting. I've attached some notes for your reference.",
    "I've been thinking about the points you raised in our discussion and have some additional thoughts to share.",
    'Just checking in to see how things are progressing on your end. Let me know if you need any assistance!',
    'I found some interesting resources that might be relevant to our project. Would love to discuss them with you.',
    'I wanted to follow up on the action items from our last meeting. Please let me know if you have any questions.',
    'I hope your week is going well. I wanted to touch base about our upcoming deadline.',
    "I've been working on the suggestions you provided and wanted to share my progress with you.",
    'Just sending a quick note to confirm our meeting next week. Looking forward to catching up!',
    "Here's our weekly progress report. We've made significant strides in several key areas.",
    'Welcome to our monthly newsletter! We have some exciting updates to share with you.',
    "We're hosting a webinar next month on industry best practices. Would you be interested in attending?",
    "Thank you for your valuable feedback. We've implemented several of your suggestions.",
    "We're excited to announce a new feature that will streamline your workflow significantly.",
    "We've updated our security protocols to better protect your data. No action is required on your part.",
    "Here's a summary of your account activity for the past month. Everything looks good!",
    'We have an upcoming event that might interest you. Details are included below.',
    'Our product team has released an update that addresses several of the issues you reported.',
    "We're conducting a survey to improve our services and would appreciate your input.",
  ];

  // HTML templates for more engaging emails
  private readonly htmlTemplates = [
    `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <p>{{body}}</p>
      <p style="margin-top: 20px;">Best regards,<br>{{sender}}</p>
    </div>`,

    `<div style="font-family: Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #444; border-top: 3px solid #4F46E5;">
      <p>{{body}}</p>
      <p style="margin-top: 20px;">Warm regards,<br>{{sender}}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #888;">This is an automated message. Please do not reply directly to this email.</p>
    </div>`,

    `<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9f9f9;">
      <p>{{body}}</p>
      <p style="margin-top: 20px;">Sincerely,<br>{{sender}}</p>
    </div>`,

    `<div style="font-family: Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <p>{{body}}</p>
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ccc;">
        <p>Thanks,<br>{{sender}}</p>
      </div>
    </div>`,

    `<div style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border-left: 4px solid #4F46E5; padding-left: 15px;">
      <p>{{body}}</p>
      <p style="margin-top: 20px;">Regards,<br>{{sender}}</p>
    </div>`,
  ];

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(EmailProvider)
    private readonly emailProviderRepo: Repository<EmailProvider>,
    @InjectRepository(EmailWarmup)
    private readonly emailWarmupRepo: Repository<EmailWarmup>,
    @InjectRepository(WarmupActivity)
    private readonly warmupActivityRepo: Repository<WarmupActivity>,
  ) {}

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
  }

  private resolveErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  async startWarmup(input: StartWarmupInput, userId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_warmup_start_requested',
        userId,
        providerId: input.providerId,
      }),
    );
    try {
      // Verify provider ownership
      const provider = await this.emailProviderRepo.findOne({
        where: { id: input.providerId, userId },
        relations: ['warmup'],
      });

      if (!provider) {
        throw new NotFoundException(
          `Provider with ID ${input.providerId} not found`,
        );
      }

      if (provider.warmup) {
        // Resume if paused
        if (provider.warmup.status === 'PAUSED') {
          this.logger.log(
            serializeStructuredLog({
              event: 'email_warmup_resume_requested',
              userId,
              providerId: input.providerId,
              warmupId: provider.warmup.id,
            }),
          );
          await this.emailWarmupRepo.update(
            { id: provider.warmup.id },
            { status: 'ACTIVE' },
          );
          this.logger.log(
            serializeStructuredLog({
              event: 'email_warmup_resume_completed',
              userId,
              providerId: input.providerId,
              warmupId: provider.warmup.id,
            }),
          );
          return this.emailWarmupRepo.findOne({
            where: { id: provider.warmup.id },
          });
        }
        throw new Error('Warm-up process already exists for this provider');
      }

      // Set default values if config is not provided
      const dailyIncrement = input.config?.dailyIncrement || 5;
      const maxDailyEmails = input.config?.maxDailyEmails || 100;
      const minimumInterval = input.config?.minimumInterval || 15;
      const targetOpenRate = input.config?.targetOpenRate || 80;

      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_start_config_resolved',
          userId,
          providerId: input.providerId,
          dailyIncrement,
          maxDailyEmails,
          minimumInterval,
          targetOpenRate,
        }),
      );
      const warmupRecord = await this.emailWarmupRepo.save(
        this.emailWarmupRepo.create({
          providerId: input.providerId,
          dailyIncrement,
          maxDailyEmails,
          minimumInterval,
          targetOpenRate,
          status: 'ACTIVE',
        }),
      );
      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_start_completed',
          userId,
          providerId: input.providerId,
          warmupId: warmupRecord.id,
          status: warmupRecord.status,
        }),
      );
      return warmupRecord;
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'email_warmup_start_failed',
          userId,
          providerId: input.providerId,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
      throw error;
    }
  }

  async pauseWarmup(input: PauseWarmupInput, userId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_warmup_pause_requested',
        userId,
        providerId: input.providerId,
      }),
    );
    try {
      const warmup = await this.emailWarmupRepo
        .createQueryBuilder('w')
        .innerJoin('w.provider', 'p')
        .where('w.providerId = :providerId', { providerId: input.providerId })
        .andWhere('p.userId = :userId', { userId })
        .getOne();

      if (!warmup) {
        throw new NotFoundException('Warm-up process not found');
      }

      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_pause_processing',
          userId,
          providerId: input.providerId,
          warmupId: warmup.id,
        }),
      );
      await this.emailWarmupRepo.update(
        { id: warmup.id },
        { status: 'PAUSED' },
      );
      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_pause_completed',
          userId,
          providerId: input.providerId,
          warmupId: warmup.id,
        }),
      );
      return this.emailWarmupRepo.findOne({ where: { id: warmup.id } });
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'email_warmup_pause_failed',
          userId,
          providerId: input.providerId,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processWarmups() {
    const runStartedAtIso = new Date().toISOString();
    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_daily_processing_start',
          runStartedAtIso,
        }),
      );
      const activeWarmups = await this.emailWarmupRepo.find({
        where: { status: 'ACTIVE' },
        relations: ['provider'],
      });

      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_daily_processing_loaded',
          runStartedAtIso,
          activeWarmupCount: activeWarmups.length,
        }),
      );

      for (const warmup of activeWarmups) {
        try {
          // Calculate new daily limit based on performance
          const gte = new Date(new Date().setDate(new Date().getDate() - 1));
          const yesterdayActivity = await this.warmupActivityRepo
            .createQueryBuilder('a')
            .where('a.warmupId = :warmupId', { warmupId: warmup.id })
            .andWhere('a.date >= :gte', { gte })
            .orderBy('a.date', 'DESC')
            .getOne();

          let newDailyLimit = warmup.currentDailyLimit;

          if (
            yesterdayActivity &&
            yesterdayActivity.openRate >= warmup.targetOpenRate
          ) {
            newDailyLimit = Math.min(
              warmup.currentDailyLimit + warmup.dailyIncrement,
              warmup.maxDailyEmails,
            );
            this.logger.log(
              serializeStructuredLog({
                event: 'email_warmup_daily_limit_increased',
                runStartedAtIso,
                warmupId: warmup.id,
                providerId: warmup.providerId,
                previousDailyLimit: warmup.currentDailyLimit,
                nextDailyLimit: newDailyLimit,
                openRate: yesterdayActivity.openRate,
                targetOpenRate: warmup.targetOpenRate,
              }),
            );
          } else if (yesterdayActivity) {
            this.logger.log(
              serializeStructuredLog({
                event: 'email_warmup_daily_limit_maintained',
                runStartedAtIso,
                warmupId: warmup.id,
                providerId: warmup.providerId,
                currentDailyLimit: newDailyLimit,
                openRate: yesterdayActivity.openRate,
                targetOpenRate: warmup.targetOpenRate,
              }),
            );
          }

          // Update warm-up configuration
          await this.emailWarmupRepo.update(
            { id: warmup.id },
            { currentDailyLimit: newDailyLimit },
          );

          // Create new activity record for today
          await this.warmupActivityRepo.save(
            this.warmupActivityRepo.create({
              warmupId: warmup.id,
              emailsSent: 0,
              openRate: 0,
            }),
          );
        } catch (error: unknown) {
          this.logger.error(
            serializeStructuredLog({
              event: 'email_warmup_daily_processing_item_failed',
              runStartedAtIso,
              warmupId: warmup.id,
              providerId: warmup.providerId,
              error: this.resolveErrorMessage(error),
            }),
            this.resolveErrorStack(error),
          );
          // Continue with next warmup
        }
      }
      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_daily_processing_completed',
          runStartedAtIso,
        }),
      );
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'email_warmup_daily_processing_failed',
          runStartedAtIso,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendWarmupEmails() {
    const runStartedAtIso = new Date().toISOString();
    try {
      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_send_cycle_start',
          runStartedAtIso,
        }),
      );
      const cutoff = new Date(Date.now() - 1000 * 60 * 15);
      // TypeORM can't easily filter relation rows; fetch and filter in-memory (OK for MVP scale).
      const activeWarmups = await this.emailWarmupRepo.find({
        where: { status: 'ACTIVE' },
        relations: ['provider', 'activities'],
      });
      const eligibleWarmups = activeWarmups.filter(
        (w) => !w.lastRunAt || w.lastRunAt < cutoff,
      );

      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_send_cycle_loaded',
          runStartedAtIso,
          activeWarmupCount: activeWarmups.length,
          eligibleWarmupCount: eligibleWarmups.length,
        }),
      );

      const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
      for (const warmup of eligibleWarmups) {
        const todayActivity = (warmup.activities || [])
          .filter((a) => a.date >= todayStart)
          .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

        if (!todayActivity) {
          this.logger.warn(
            serializeStructuredLog({
              event: 'email_warmup_send_cycle_missing_activity',
              runStartedAtIso,
              warmupId: warmup.id,
              providerId: warmup.providerId,
            }),
          );
          continue;
        }

        if (todayActivity.emailsSent >= warmup.currentDailyLimit) {
          this.logger.log(
            serializeStructuredLog({
              event: 'email_warmup_send_cycle_daily_limit_reached',
              runStartedAtIso,
              warmupId: warmup.id,
              providerId: warmup.providerId,
              emailsSentToday: todayActivity.emailsSent,
              currentDailyLimit: warmup.currentDailyLimit,
            }),
          );
          continue;
        }

        // Send warm-up email with varied content
        try {
          // Get random subject, body, and template
          const subjectIndex = Math.floor(
            Math.random() * this.warmupSubjects.length,
          );
          const bodyIndex = Math.floor(
            Math.random() * this.warmupBodies.length,
          );
          const templateIndex = Math.floor(
            Math.random() * this.htmlTemplates.length,
          );

          const subject = this.warmupSubjects[subjectIndex];
          const bodyText = this.warmupBodies[bodyIndex];
          const senderName = warmup.provider.email.split('@')[0];

          // Generate HTML content from template
          const body = this.htmlTemplates[templateIndex]
            .replace('{{body}}', bodyText)
            .replace('{{sender}}', senderName);

          // Add some randomization to make each email unique
          const uniqueId = Math.random().toString(36).substring(2, 10);
          const finalBody = `${body}
            <!-- Unique identifier: ${uniqueId} -->
            <img src="https://via.placeholder.com/1x1.png?text=${uniqueId}" width="1" height="1" style="display:none">`;

          this.logger.log(
            serializeStructuredLog({
              event: 'email_warmup_send_cycle_dispatching',
              runStartedAtIso,
              warmupId: warmup.id,
              providerId: warmup.providerId,
              emailOrdinal: todayActivity.emailsSent + 1,
              currentDailyLimit: warmup.currentDailyLimit,
              subjectIndex,
              bodyIndex,
              templateIndex,
            }),
          );

          await this.emailService.sendEmail(
            {
              subject,
              body: finalBody,
              from: warmup.provider.email,
              to: [warmup.provider.email], // Send to self for warm-up
              providerId: warmup.providerId,
            },
            warmup.provider.userId,
          );

          // Update activity record
          await this.warmupActivityRepo.update(
            { id: todayActivity.id },
            { emailsSent: todayActivity.emailsSent + 1 },
          );

          // Update last run time
          await this.emailWarmupRepo.update(
            { id: warmup.id },
            { lastRunAt: new Date() },
          );
          this.logger.log(
            serializeStructuredLog({
              event: 'email_warmup_send_cycle_dispatch_completed',
              runStartedAtIso,
              warmupId: warmup.id,
              providerId: warmup.providerId,
              updatedEmailsSentToday: todayActivity.emailsSent + 1,
            }),
          );
        } catch (error: unknown) {
          this.logger.error(
            serializeStructuredLog({
              event: 'email_warmup_send_cycle_dispatch_failed',
              runStartedAtIso,
              warmupId: warmup.id,
              providerId: warmup.providerId,
              error: this.resolveErrorMessage(error),
            }),
            this.resolveErrorStack(error),
          );
        }
      }
      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_send_cycle_completed',
          runStartedAtIso,
        }),
      );
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'email_warmup_send_cycle_failed',
          runStartedAtIso,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
    }
  }

  async getWarmupStatus(providerId: string, userId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_warmup_status_query_start',
        userId,
        providerId,
      }),
    );
    try {
      const warmup = await this.emailWarmupRepo
        .createQueryBuilder('w')
        .innerJoinAndSelect('w.provider', 'p')
        .leftJoinAndSelect('w.activities', 'a')
        .where('w.providerId = :providerId', { providerId })
        .andWhere('p.userId = :userId', { userId })
        .getOne();

      if (warmup?.activities?.length) {
        warmup.activities = warmup.activities
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 7);
      }

      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_status_query_completed',
          userId,
          providerId,
          foundWarmup: Boolean(warmup),
        }),
      );
      return warmup;
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'email_warmup_status_query_failed',
          userId,
          providerId,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
      throw error;
    }
  }

  async getWarmupPerformanceMetrics(warmupId: string): Promise<{
    averageOpenRate: number;
    totalEmailsSent: number;
    daysActive: number;
    currentPhase: string;
  }> {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_warmup_metrics_query_start',
        warmupId,
      }),
    );
    try {
      const warmup = await this.emailWarmupRepo.findOne({
        where: { id: warmupId },
        relations: ['activities'],
      });

      if (!warmup) {
        throw new NotFoundException('Warm-up process not found');
      }

      const totalEmailsSent = warmup.activities.reduce(
        (sum, activity) => sum + activity.emailsSent,
        0,
      );
      const totalOpenRate = warmup.activities.reduce(
        (sum, activity) => sum + activity.openRate,
        0,
      );
      const daysActive = warmup.activities.length;
      const averageOpenRate = daysActive > 0 ? totalOpenRate / daysActive : 0;

      // Calculate warm-up phase based on current daily limit
      let currentPhase = 'Initial';
      if (warmup.currentDailyLimit >= warmup.maxDailyEmails) {
        currentPhase = 'Completed';
      } else if (warmup.currentDailyLimit >= warmup.maxDailyEmails * 0.7) {
        currentPhase = 'Advanced';
      } else if (warmup.currentDailyLimit >= warmup.maxDailyEmails * 0.3) {
        currentPhase = 'Intermediate';
      }

      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_metrics_query_completed',
          warmupId,
          averageOpenRate,
          totalEmailsSent,
          daysActive,
          currentPhase,
        }),
      );
      return {
        averageOpenRate,
        totalEmailsSent,
        daysActive,
        currentPhase,
      };
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'email_warmup_metrics_query_failed',
          warmupId,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
      throw error;
    }
  }

  async adjustWarmupStrategy(warmupId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_warmup_strategy_adjust_start',
        warmupId,
      }),
    );
    try {
      const warmup = await this.emailWarmupRepo.findOne({
        where: { id: warmupId },
        relations: ['activities'],
      });

      if (!warmup) {
        throw new NotFoundException('Warm-up process not found');
      }

      // Calculate recent performance
      const recentActivities = (warmup.activities || [])
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 3);
      const averageRecentOpenRate =
        recentActivities.length > 0
          ? recentActivities.reduce(
              (sum, activity) => sum + activity.openRate,
              0,
            ) / recentActivities.length
          : 0;

      // Adjust strategy based on performance
      let adjustedDailyIncrement = warmup.dailyIncrement;
      let adjustedMinimumInterval = warmup.minimumInterval;

      if (averageRecentOpenRate < warmup.targetOpenRate * 0.8) {
        // Poor performance - slow down
        adjustedDailyIncrement = Math.max(1, warmup.dailyIncrement - 2);
        adjustedMinimumInterval = Math.min(60, warmup.minimumInterval + 5);
        this.logger.log(
          serializeStructuredLog({
            event: 'email_warmup_strategy_adjust_slow_down',
            warmupId,
            averageRecentOpenRate,
            targetOpenRate: warmup.targetOpenRate,
            adjustedDailyIncrement,
            adjustedMinimumInterval,
          }),
        );
      } else if (averageRecentOpenRate > warmup.targetOpenRate * 1.2) {
        // Excellent performance - speed up
        adjustedDailyIncrement = Math.min(10, warmup.dailyIncrement + 2);
        adjustedMinimumInterval = Math.max(10, warmup.minimumInterval - 5);
        this.logger.log(
          serializeStructuredLog({
            event: 'email_warmup_strategy_adjust_speed_up',
            warmupId,
            averageRecentOpenRate,
            targetOpenRate: warmup.targetOpenRate,
            adjustedDailyIncrement,
            adjustedMinimumInterval,
          }),
        );
      } else {
        this.logger.log(
          serializeStructuredLog({
            event: 'email_warmup_strategy_adjust_maintain',
            warmupId,
            averageRecentOpenRate,
            targetOpenRate: warmup.targetOpenRate,
            adjustedDailyIncrement,
            adjustedMinimumInterval,
          }),
        );
      }

      await this.emailWarmupRepo.update(
        { id: warmupId },
        {
          dailyIncrement: adjustedDailyIncrement,
          minimumInterval: adjustedMinimumInterval,
        },
      );
      this.logger.log(
        serializeStructuredLog({
          event: 'email_warmup_strategy_adjust_completed',
          warmupId,
          adjustedDailyIncrement,
          adjustedMinimumInterval,
        }),
      );
      return this.emailWarmupRepo.findOne({ where: { id: warmupId } });
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'email_warmup_strategy_adjust_failed',
          warmupId,
          error: this.resolveErrorMessage(error),
        }),
        this.resolveErrorStack(error),
      );
      throw error;
    }
  }
}
