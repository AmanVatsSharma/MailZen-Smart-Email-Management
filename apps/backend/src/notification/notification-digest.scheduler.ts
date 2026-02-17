import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

type NotificationDigestSendStatus = 'sent' | 'skipped' | 'failed';

@Injectable()
export class NotificationDigestScheduler {
  private static readonly DEFAULT_WINDOW_HOURS = 24;
  private static readonly DEFAULT_MAX_USERS_PER_RUN = 250;
  private static readonly DEFAULT_MAX_ITEMS_PER_DIGEST = 8;
  private readonly logger = new Logger(NotificationDigestScheduler.name);

  constructor(
    @InjectRepository(UserNotificationPreference)
    private readonly preferenceRepo: Repository<UserNotificationPreference>,
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailerService: MailerService,
  ) {}

  @Cron('0 * * * *')
  async sendUnreadDigestEmails() {
    const runCorrelationId = resolveCorrelationId(undefined);
    const windowHours = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_NOTIFICATION_DIGEST_WINDOW_HOURS,
      fallbackValue: NotificationDigestScheduler.DEFAULT_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: 24 * 7,
    });
    const maxUsersPerRun = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_NOTIFICATION_DIGEST_MAX_USERS_PER_RUN,
      fallbackValue: NotificationDigestScheduler.DEFAULT_MAX_USERS_PER_RUN,
      minimumValue: 1,
      maximumValue: 5_000,
    });
    const maxItemsPerDigest = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_NOTIFICATION_DIGEST_MAX_ITEMS,
      fallbackValue: NotificationDigestScheduler.DEFAULT_MAX_ITEMS_PER_DIGEST,
      minimumValue: 1,
      maximumValue: 50,
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'notification_digest_run_start',
        runCorrelationId,
        windowHours,
        maxUsersPerRun,
        maxItemsPerDigest,
      }),
    );
    const preferences = await this.preferenceRepo.find({
      where: { emailEnabled: true, notificationDigestEnabled: true },
      order: { updatedAt: 'DESC' },
      take: maxUsersPerRun,
    });
    if (!preferences.length) {
      this.logger.log(
        serializeStructuredLog({
          event: 'notification_digest_run_completed',
          runCorrelationId,
          windowHours,
          maxUsersPerRun,
          maxItemsPerDigest,
          totalCandidates: 0,
          sentDigests: 0,
          skippedDigests: 0,
          failedDigests: 0,
        }),
      );
      return;
    }

    let sentDigests = 0;
    let skippedDigests = 0;
    let failedDigests = 0;

    for (const preference of preferences) {
      const status = await this.sendDigestForPreference({
        preference,
        windowHours,
        maxItemsPerDigest,
        runCorrelationId,
      });
      if (status === 'sent') {
        sentDigests += 1;
      } else if (status === 'failed') {
        failedDigests += 1;
      } else {
        skippedDigests += 1;
      }
    }

    this.logger.log(
      serializeStructuredLog({
        event: 'notification_digest_run_completed',
        runCorrelationId,
        windowHours,
        maxUsersPerRun,
        maxItemsPerDigest,
        totalCandidates: preferences.length,
        sentDigests,
        skippedDigests,
        failedDigests,
      }),
    );
  }

  private async sendDigestForPreference(input: {
    preference: UserNotificationPreference;
    windowHours: number;
    maxItemsPerDigest: number;
    runCorrelationId: string;
  }): Promise<NotificationDigestSendStatus> {
    const userId = String(input.preference.userId || '').trim();
    if (!userId) {
      this.logger.log(
        serializeStructuredLog({
          event: 'notification_digest_user_skipped',
          runCorrelationId: input.runCorrelationId,
          reason: 'missing-user-id',
        }),
      );
      return 'skipped';
    }
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });
    if (!user?.email) {
      this.logger.log(
        serializeStructuredLog({
          event: 'notification_digest_user_skipped',
          runCorrelationId: input.runCorrelationId,
          userId,
          reason: 'missing-user-email',
        }),
      );
      return 'skipped';
    }

    const windowStart = this.resolveDigestWindowStart({
      lastSentAt: input.preference.notificationDigestLastSentAt || null,
      fallbackWindowHours: input.windowHours,
    });
    const unreadWhereClause = {
      userId,
      isRead: false,
      createdAt: MoreThanOrEqual(windowStart),
    };
    const unreadNotifications = await this.notificationRepo.find({
      where: unreadWhereClause,
      order: { createdAt: 'DESC' },
      take: input.maxItemsPerDigest,
    });
    if (!unreadNotifications.length) {
      this.logger.log(
        serializeStructuredLog({
          event: 'notification_digest_user_skipped',
          runCorrelationId: input.runCorrelationId,
          userId,
          reason: 'no-unread-notifications',
        }),
      );
      return 'skipped';
    }

    const unreadTotalCount = await this.notificationRepo.count({
      where: unreadWhereClause,
    });
    const digestText = this.renderDigestText({
      notifications: unreadNotifications,
      unreadTotalCount,
      windowStart,
    });
    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: `[MailZen] ${unreadTotalCount} unread notifications`,
        text: digestText,
      });
      input.preference.notificationDigestLastSentAt = new Date();
      await this.preferenceRepo.save(input.preference);
      this.logger.log(
        serializeStructuredLog({
          event: 'notification_digest_user_sent',
          runCorrelationId: input.runCorrelationId,
          userId,
          unreadTotalCount,
          sampledNotifications: unreadNotifications.length,
          windowStartIso: windowStart.toISOString(),
        }),
      );
      return 'sent';
    } catch (error: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'notification_digest_user_failed',
          runCorrelationId: input.runCorrelationId,
          userId,
          unreadTotalCount,
          sampledNotifications: unreadNotifications.length,
          error:
            error instanceof Error ? error.message : 'unknown digest failure',
        }),
      );
      return 'failed';
    }
  }

  private renderDigestText(input: {
    notifications: UserNotification[];
    unreadTotalCount: number;
    windowStart: Date;
  }): string {
    const lines = input.notifications.map((notification, index) => {
      const createdAt = notification.createdAt.toISOString();
      return `${index + 1}. [${notification.type}] ${notification.title} (${createdAt})\n${notification.message}`;
    });
    return [
      `MailZen notification digest`,
      '',
      `Unread notifications: ${input.unreadTotalCount}`,
      `Window start: ${input.windowStart.toISOString()}`,
      '',
      ...lines,
    ].join('\n');
  }

  private resolveDigestWindowStart(input: {
    lastSentAt: Date | null;
    fallbackWindowHours: number;
  }): Date {
    if (input.lastSentAt) return new Date(input.lastSentAt);
    return new Date(Date.now() - input.fallbackWindowHours * 60 * 60 * 1000);
  }

  private resolvePositiveInteger(input: {
    rawValue?: string;
    fallbackValue: number;
    minimumValue: number;
    maximumValue: number;
  }): number {
    const parsedValue = Number(input.rawValue);
    const candidate = Number.isFinite(parsedValue)
      ? Math.floor(parsedValue)
      : input.fallbackValue;
    if (candidate < input.minimumValue) return input.minimumValue;
    if (candidate > input.maximumValue) return input.maximumValue;
    return candidate;
  }
}
