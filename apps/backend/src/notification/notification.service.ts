import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { UpdateNotificationPreferencesInput } from './dto/update-notification-preferences.input';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type MailboxInboundNotificationStatus =
  | 'ACCEPTED'
  | 'DEDUPLICATED'
  | 'REJECTED';
type MailboxInboundSlaStatus = 'WARNING' | 'CRITICAL' | 'HEALTHY' | 'NO_DATA';

@Injectable()
export class NotificationService {
  private static readonly DEFAULT_MAILBOX_INBOUND_SLA_TARGET_SUCCESS_PERCENT = 99;
  private static readonly DEFAULT_MAILBOX_INBOUND_SLA_WARNING_REJECTED_PERCENT = 1;
  private static readonly DEFAULT_MAILBOX_INBOUND_SLA_CRITICAL_REJECTED_PERCENT = 5;
  private static readonly DEFAULT_MAILBOX_INBOUND_INCIDENT_WINDOW_HOURS = 24;
  private static readonly MAX_MAILBOX_INBOUND_INCIDENT_WINDOW_HOURS = 24 * 30;

  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
    @InjectRepository(UserNotificationPreference)
    private readonly notificationPreferenceRepo: Repository<UserNotificationPreference>,
  ) {}

  private getDefaultPreference(userId: string): UserNotificationPreference {
    const targetSuccessPercent = this.normalizeThresholdInput(
      process.env.MAILZEN_INBOUND_SLA_TARGET_SUCCESS_PERCENT,
      NotificationService.DEFAULT_MAILBOX_INBOUND_SLA_TARGET_SUCCESS_PERCENT,
    );
    const warningRejectedPercent = this.normalizeThresholdInput(
      process.env.MAILZEN_INBOUND_SLA_WARNING_REJECTION_PERCENT,
      NotificationService.DEFAULT_MAILBOX_INBOUND_SLA_WARNING_REJECTED_PERCENT,
    );
    const criticalRejectedPercent = this.normalizeThresholdInput(
      process.env.MAILZEN_INBOUND_SLA_CRITICAL_REJECTION_PERCENT,
      NotificationService.DEFAULT_MAILBOX_INBOUND_SLA_CRITICAL_REJECTED_PERCENT,
    );
    const normalizedThresholds = this.normalizeThresholdOrder({
      targetSuccessPercent,
      warningRejectedPercent,
      criticalRejectedPercent,
    });
    const row = this.notificationPreferenceRepo.create({
      userId,
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      syncFailureEnabled: true,
      mailboxInboundAcceptedEnabled: true,
      mailboxInboundDeduplicatedEnabled: false,
      mailboxInboundRejectedEnabled: true,
      mailboxInboundSlaTargetSuccessPercent:
        normalizedThresholds.targetSuccessPercent,
      mailboxInboundSlaWarningRejectedPercent:
        normalizedThresholds.warningRejectedPercent,
      mailboxInboundSlaCriticalRejectedPercent:
        normalizedThresholds.criticalRejectedPercent,
      mailboxInboundSlaAlertsEnabled: true,
      mailboxInboundSlaLastAlertStatus: null,
      mailboxInboundSlaLastAlertedAt: null,
    });
    return row;
  }

  async getOrCreatePreferences(
    userId: string,
  ): Promise<UserNotificationPreference> {
    const existing = await this.notificationPreferenceRepo.findOne({
      where: { userId },
    });
    if (existing) return existing;
    return this.notificationPreferenceRepo.save(
      this.getDefaultPreference(userId),
    );
  }

  async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<UserNotificationPreference> {
    const existing = await this.getOrCreatePreferences(userId);
    if (typeof input.inAppEnabled === 'boolean') {
      existing.inAppEnabled = input.inAppEnabled;
    }
    if (typeof input.emailEnabled === 'boolean') {
      existing.emailEnabled = input.emailEnabled;
    }
    if (typeof input.pushEnabled === 'boolean') {
      existing.pushEnabled = input.pushEnabled;
    }
    if (typeof input.syncFailureEnabled === 'boolean') {
      existing.syncFailureEnabled = input.syncFailureEnabled;
    }
    if (typeof input.mailboxInboundAcceptedEnabled === 'boolean') {
      existing.mailboxInboundAcceptedEnabled =
        input.mailboxInboundAcceptedEnabled;
    }
    if (typeof input.mailboxInboundDeduplicatedEnabled === 'boolean') {
      existing.mailboxInboundDeduplicatedEnabled =
        input.mailboxInboundDeduplicatedEnabled;
    }
    if (typeof input.mailboxInboundRejectedEnabled === 'boolean') {
      existing.mailboxInboundRejectedEnabled =
        input.mailboxInboundRejectedEnabled;
    }
    if (typeof input.mailboxInboundSlaTargetSuccessPercent === 'number') {
      existing.mailboxInboundSlaTargetSuccessPercent =
        this.normalizeThresholdInput(
          input.mailboxInboundSlaTargetSuccessPercent,
          existing.mailboxInboundSlaTargetSuccessPercent,
        );
    }
    if (typeof input.mailboxInboundSlaWarningRejectedPercent === 'number') {
      existing.mailboxInboundSlaWarningRejectedPercent =
        this.normalizeThresholdInput(
          input.mailboxInboundSlaWarningRejectedPercent,
          existing.mailboxInboundSlaWarningRejectedPercent,
        );
    }
    if (typeof input.mailboxInboundSlaCriticalRejectedPercent === 'number') {
      existing.mailboxInboundSlaCriticalRejectedPercent =
        this.normalizeThresholdInput(
          input.mailboxInboundSlaCriticalRejectedPercent,
          existing.mailboxInboundSlaCriticalRejectedPercent,
        );
    }
    if (typeof input.mailboxInboundSlaAlertsEnabled === 'boolean') {
      existing.mailboxInboundSlaAlertsEnabled =
        input.mailboxInboundSlaAlertsEnabled;
    }
    const normalizedThresholds = this.normalizeThresholdOrder({
      targetSuccessPercent: existing.mailboxInboundSlaTargetSuccessPercent,
      warningRejectedPercent: existing.mailboxInboundSlaWarningRejectedPercent,
      criticalRejectedPercent:
        existing.mailboxInboundSlaCriticalRejectedPercent,
    });
    existing.mailboxInboundSlaTargetSuccessPercent =
      normalizedThresholds.targetSuccessPercent;
    existing.mailboxInboundSlaWarningRejectedPercent =
      normalizedThresholds.warningRejectedPercent;
    existing.mailboxInboundSlaCriticalRejectedPercent =
      normalizedThresholds.criticalRejectedPercent;
    return this.notificationPreferenceRepo.save(existing);
  }

  private normalizeThresholdInput(rawValue: unknown, fallback: number): number {
    const numericValue = Number(rawValue);
    const candidate = Number.isFinite(numericValue) ? numericValue : fallback;
    if (candidate < 0) return 0;
    if (candidate > 100) return 100;
    return Math.round(candidate * 100) / 100;
  }

  private normalizeThresholdOrder(input: {
    targetSuccessPercent: number;
    warningRejectedPercent: number;
    criticalRejectedPercent: number;
  }): {
    targetSuccessPercent: number;
    warningRejectedPercent: number;
    criticalRejectedPercent: number;
  } {
    const warningRejectedPercent = Math.min(
      input.warningRejectedPercent,
      input.criticalRejectedPercent,
    );
    const criticalRejectedPercent = Math.max(
      input.warningRejectedPercent,
      input.criticalRejectedPercent,
    );
    return {
      targetSuccessPercent: input.targetSuccessPercent,
      warningRejectedPercent,
      criticalRejectedPercent,
    };
  }

  private resolveMailboxInboundStatus(
    metadata?: Record<string, unknown>,
  ): MailboxInboundNotificationStatus {
    const rawStatus = metadata?.inboundStatus;
    if (typeof rawStatus !== 'string') return 'ACCEPTED';

    const normalizedStatus = rawStatus.trim().toUpperCase();
    if (normalizedStatus === 'DEDUPLICATED') return 'DEDUPLICATED';
    if (normalizedStatus === 'REJECTED') return 'REJECTED';
    return 'ACCEPTED';
  }

  private resolveIgnoredPreferenceKey(
    preference: UserNotificationPreference,
    input: CreateNotificationInput,
  ): string | null {
    if (input.type === 'SYNC_FAILED' && !preference.syncFailureEnabled) {
      return 'syncFailureEnabled';
    }
    if (
      input.type === 'MAILBOX_INBOUND_SLA_ALERT' &&
      !preference.mailboxInboundSlaAlertsEnabled
    ) {
      return 'mailboxInboundSlaAlertsEnabled';
    }

    if (input.type !== 'MAILBOX_INBOUND') return null;
    const mailboxInboundStatus = this.resolveMailboxInboundStatus(
      input.metadata,
    );
    if (
      mailboxInboundStatus === 'ACCEPTED' &&
      !preference.mailboxInboundAcceptedEnabled
    ) {
      return 'mailboxInboundAcceptedEnabled';
    }
    if (
      mailboxInboundStatus === 'DEDUPLICATED' &&
      !preference.mailboxInboundDeduplicatedEnabled
    ) {
      return 'mailboxInboundDeduplicatedEnabled';
    }
    if (
      mailboxInboundStatus === 'REJECTED' &&
      !preference.mailboxInboundRejectedEnabled
    ) {
      return 'mailboxInboundRejectedEnabled';
    }
    return null;
  }

  private resolveWorkspaceId(
    metadata?: Record<string, unknown>,
  ): string | null {
    const rawWorkspaceId = metadata?.workspaceId;
    if (typeof rawWorkspaceId !== 'string') return null;
    const normalizedWorkspaceId = rawWorkspaceId.trim();
    return normalizedWorkspaceId || null;
  }

  async createNotification(
    input: CreateNotificationInput,
  ): Promise<UserNotification> {
    const preference = await this.getOrCreatePreferences(input.userId);
    const workspaceId = this.resolveWorkspaceId(input.metadata);
    if (!preference.inAppEnabled) {
      const muted = this.notificationRepo.create({
        userId: input.userId,
        workspaceId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: {
          ...(input.metadata || {}),
          muted: true,
        },
        isRead: true,
      });
      return this.notificationRepo.save(muted);
    }

    const ignoredPreferenceKey = this.resolveIgnoredPreferenceKey(
      preference,
      input,
    );
    if (ignoredPreferenceKey) {
      const ignored = this.notificationRepo.create({
        userId: input.userId,
        workspaceId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: {
          ...(input.metadata || {}),
          ignoredByPreference: true,
          ignoredPreferenceKey,
        },
        isRead: true,
      });
      return this.notificationRepo.save(ignored);
    }

    const notification = this.notificationRepo.create({
      userId: input.userId,
      workspaceId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata,
      isRead: false,
    });
    return this.notificationRepo.save(notification);
  }

  async listNotificationsForUser(input: {
    userId: string;
    limit?: number;
    unreadOnly?: boolean;
    types?: string[] | null;
    sinceHours?: number | null;
    workspaceId?: string | null;
  }): Promise<UserNotification[]> {
    const limit = Math.max(1, Math.min(100, input.limit || 20));
    const normalizedSinceHours =
      typeof input.sinceHours === 'number' && Number.isFinite(input.sinceHours)
        ? Math.max(1, Math.min(24 * 30, Math.floor(input.sinceHours)))
        : null;
    const createdAfterDate =
      normalizedSinceHours === null
        ? null
        : new Date(Date.now() - normalizedSinceHours * 60 * 60 * 1000);
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedTypes = (input.types || [])
      .map((type) =>
        String(type || '')
          .trim()
          .toUpperCase(),
      )
      .filter((type) => type.length > 0);
    const baseWhere = {
      userId: input.userId,
      ...(input.unreadOnly ? { isRead: false } : {}),
      ...(normalizedTypes.length ? { type: In(normalizedTypes) } : {}),
      ...(createdAfterDate
        ? { createdAt: MoreThanOrEqual(createdAfterDate) }
        : {}),
    };
    const whereClause = normalizedWorkspaceId
      ? [
          { ...baseWhere, workspaceId: normalizedWorkspaceId },
          { ...baseWhere, workspaceId: IsNull() },
        ]
      : baseWhere;

    return this.notificationRepo.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  async markNotificationRead(
    notificationId: string,
    userId: string,
  ): Promise<UserNotification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.isRead) return notification;
    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }

  async getMailboxInboundSlaIncidentStats(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
  }): Promise<{
    workspaceId?: string | null;
    windowHours: number;
    totalCount: number;
    warningCount: number;
    criticalCount: number;
    lastAlertAt?: Date | null;
  }> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const windowHours = this.normalizeIncidentWindowHours(input.windowHours);
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const statsQuery = this.notificationRepo
      .createQueryBuilder('notification')
      .select('COUNT(*)', 'totalCount')
      .addSelect(
        `SUM(CASE WHEN notification.metadata ->> 'slaStatus' = 'WARNING' THEN 1 ELSE 0 END)`,
        'warningCount',
      )
      .addSelect(
        `SUM(CASE WHEN notification.metadata ->> 'slaStatus' = 'CRITICAL' THEN 1 ELSE 0 END)`,
        'criticalCount',
      )
      .addSelect('MAX(notification.createdAt)', 'lastAlertAt')
      .where('notification.userId = :userId', { userId: input.userId })
      .andWhere('notification.type = :type', {
        type: 'MAILBOX_INBOUND_SLA_ALERT',
      })
      .andWhere('notification.createdAt >= :windowStart', {
        windowStart: windowStartDate.toISOString(),
      });
    if (normalizedWorkspaceId) {
      statsQuery.andWhere(
        '(notification.workspaceId = :workspaceId OR notification.workspaceId IS NULL)',
        { workspaceId: normalizedWorkspaceId },
      );
    }
    const aggregate = await statsQuery.getRawOne<{
      totalCount?: string;
      warningCount?: string;
      criticalCount?: string;
      lastAlertAt?: string | null;
    }>();

    return {
      workspaceId: normalizedWorkspaceId || null,
      windowHours,
      totalCount: Number(aggregate?.totalCount || '0'),
      warningCount: Number(aggregate?.warningCount || '0'),
      criticalCount: Number(aggregate?.criticalCount || '0'),
      lastAlertAt: aggregate?.lastAlertAt
        ? new Date(aggregate.lastAlertAt)
        : null,
    };
  }

  async updateMailboxInboundSlaAlertState(input: {
    userId: string;
    status: MailboxInboundSlaStatus | null;
    alertedAt: Date | null;
  }): Promise<UserNotificationPreference> {
    const preference = await this.getOrCreatePreferences(input.userId);
    preference.mailboxInboundSlaLastAlertStatus = input.status;
    preference.mailboxInboundSlaLastAlertedAt = input.alertedAt;
    return this.notificationPreferenceRepo.save(preference);
  }

  private normalizeIncidentWindowHours(windowHours?: number | null): number {
    const candidate =
      typeof windowHours === 'number' && Number.isFinite(windowHours)
        ? Math.floor(windowHours)
        : NotificationService.DEFAULT_MAILBOX_INBOUND_INCIDENT_WINDOW_HOURS;
    if (candidate < 1) return 1;
    if (
      candidate > NotificationService.MAX_MAILBOX_INBOUND_INCIDENT_WINDOW_HOURS
    ) {
      return NotificationService.MAX_MAILBOX_INBOUND_INCIDENT_WINDOW_HOURS;
    }
    return candidate;
  }
}
