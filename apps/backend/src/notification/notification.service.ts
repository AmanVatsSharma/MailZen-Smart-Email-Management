import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Subject, filter, map } from 'rxjs';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { NotificationDataExportResponse } from './dto/notification-data-export.response';
import { NotificationRetentionPurgeResponse } from './dto/notification-retention-purge.response';
import { RegisterNotificationPushSubscriptionInput } from './dto/register-notification-push-subscription.input';
import { NotificationPushSubscription } from './entities/notification-push-subscription.entity';
import { UpdateNotificationPreferencesInput } from './dto/update-notification-preferences.input';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationPushService } from './notification-push.service';
import { NotificationWebhookService } from './notification-webhook.service';

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
export type NotificationRealtimeEvent = {
  eventType: 'NOTIFICATION_CREATED' | 'NOTIFICATIONS_MARKED_READ';
  userId: string;
  workspaceId?: string | null;
  notificationId?: string;
  notificationType?: string;
  notificationTitle?: string;
  notificationMessage?: string;
  markedCount?: number;
  createdAtIso: string;
};

@Injectable()
export class NotificationService {
  private static readonly DEFAULT_MAILBOX_INBOUND_SLA_TARGET_SUCCESS_PERCENT = 99;
  private static readonly DEFAULT_MAILBOX_INBOUND_SLA_WARNING_REJECTED_PERCENT = 1;
  private static readonly DEFAULT_MAILBOX_INBOUND_SLA_CRITICAL_REJECTED_PERCENT = 5;
  private static readonly DEFAULT_MAILBOX_INBOUND_SLA_ALERT_COOLDOWN_MINUTES = 60;
  private static readonly MIN_MAILBOX_INBOUND_SLA_ALERT_COOLDOWN_MINUTES = 1;
  private static readonly MAX_MAILBOX_INBOUND_SLA_ALERT_COOLDOWN_MINUTES =
    24 * 60;
  private static readonly DEFAULT_MAILBOX_INBOUND_INCIDENT_WINDOW_HOURS = 24;
  private static readonly MAX_MAILBOX_INBOUND_INCIDENT_WINDOW_HOURS = 24 * 30;
  private static readonly DEFAULT_MAILBOX_INBOUND_INCIDENT_BUCKET_MINUTES = 60;
  private static readonly MIN_MAILBOX_INBOUND_INCIDENT_BUCKET_MINUTES = 5;
  private static readonly MAX_MAILBOX_INBOUND_INCIDENT_BUCKET_MINUTES = 24 * 60;
  private readonly realtimeEventBus = new Subject<NotificationRealtimeEvent>();

  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
    @InjectRepository(UserNotificationPreference)
    private readonly notificationPreferenceRepo: Repository<UserNotificationPreference>,
    @InjectRepository(NotificationPushSubscription)
    private readonly pushSubscriptionRepo: Repository<NotificationPushSubscription>,
    private readonly notificationWebhookService: NotificationWebhookService,
    private readonly notificationPushService: NotificationPushService,
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
    const alertCooldownMinutes = this.normalizeCooldownMinutes(
      process.env.MAILZEN_INBOUND_SLA_ALERT_COOLDOWN_MINUTES,
      NotificationService.DEFAULT_MAILBOX_INBOUND_SLA_ALERT_COOLDOWN_MINUTES,
    );
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
      notificationDigestEnabled: true,
      mailboxInboundSlaAlertCooldownMinutes: alertCooldownMinutes,
      mailboxInboundSlaLastAlertStatus: null,
      mailboxInboundSlaLastAlertedAt: null,
      notificationDigestLastSentAt: null,
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
    if (typeof input.notificationDigestEnabled === 'boolean') {
      existing.notificationDigestEnabled = input.notificationDigestEnabled;
    }
    if (typeof input.mailboxInboundSlaAlertCooldownMinutes === 'number') {
      existing.mailboxInboundSlaAlertCooldownMinutes =
        this.normalizeCooldownMinutes(
          input.mailboxInboundSlaAlertCooldownMinutes,
          existing.mailboxInboundSlaAlertCooldownMinutes,
        );
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

  private normalizeCooldownMinutes(
    rawValue: unknown,
    fallback: number,
  ): number {
    const numericValue = Number(rawValue);
    const candidate = Number.isFinite(numericValue)
      ? Math.floor(numericValue)
      : fallback;
    if (
      candidate <
      NotificationService.MIN_MAILBOX_INBOUND_SLA_ALERT_COOLDOWN_MINUTES
    ) {
      return NotificationService.MIN_MAILBOX_INBOUND_SLA_ALERT_COOLDOWN_MINUTES;
    }
    if (
      candidate >
      NotificationService.MAX_MAILBOX_INBOUND_SLA_ALERT_COOLDOWN_MINUTES
    ) {
      return NotificationService.MAX_MAILBOX_INBOUND_SLA_ALERT_COOLDOWN_MINUTES;
    }
    return candidate;
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
    if (
      ['SYNC_FAILED', 'SYNC_RECOVERED', 'MAILBOX_SYNC_INCIDENT_ALERT'].includes(
        input.type,
      ) &&
      !preference.syncFailureEnabled
    ) {
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
    metadata?:
      | Record<string, unknown>
      | { workspaceId?: string | null | undefined },
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
    const savedNotification = await this.notificationRepo.save(notification);
    this.publishRealtimeEvent({
      eventType: 'NOTIFICATION_CREATED',
      userId: savedNotification.userId,
      workspaceId: savedNotification.workspaceId || null,
      notificationId: savedNotification.id,
      notificationType: savedNotification.type,
      notificationTitle: savedNotification.title,
      notificationMessage: savedNotification.message,
    });
    await this.notificationWebhookService.dispatchNotificationCreated(
      savedNotification,
    );
    if (preference.pushEnabled) {
      await this.notificationPushService.dispatchNotificationCreated(
        savedNotification,
      );
    }
    return savedNotification;
  }

  observeRealtimeEvents(input: {
    userId: string;
    workspaceId?: string | null;
  }): Observable<NotificationRealtimeEvent> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    return this.realtimeEventBus.pipe(
      filter((event) => event.userId === input.userId),
      filter((event) => {
        if (!normalizedWorkspaceId) return true;
        return (
          event.workspaceId === normalizedWorkspaceId ||
          event.workspaceId === null
        );
      }),
      map((event) => ({ ...event })),
    );
  }

  async listPushSubscriptionsForUser(input: {
    userId: string;
    workspaceId?: string | null;
  }): Promise<NotificationPushSubscription[]> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    if (!normalizedWorkspaceId) {
      return this.pushSubscriptionRepo.find({
        where: {
          userId: input.userId,
        },
        order: { updatedAt: 'DESC' },
      });
    }
    return this.pushSubscriptionRepo.find({
      where: [
        {
          userId: input.userId,
          workspaceId: normalizedWorkspaceId,
        },
        {
          userId: input.userId,
          workspaceId: IsNull(),
        },
      ],
      order: { updatedAt: 'DESC' },
    });
  }

  async registerPushSubscription(input: {
    userId: string;
    payload: RegisterNotificationPushSubscriptionInput;
  }): Promise<NotificationPushSubscription> {
    const endpoint = String(input.payload.endpoint || '').trim();
    const p256dh = String(input.payload.p256dh || '').trim();
    const auth = String(input.payload.auth || '').trim();
    const workspaceId = this.resolveWorkspaceId({
      workspaceId: input.payload.workspaceId,
    });
    const userAgent = String(input.payload.userAgent || '').trim() || null;

    if (!endpoint.startsWith('https://')) {
      throw new BadRequestException('Push endpoint must be a valid https URL');
    }
    if (!p256dh || !auth) {
      throw new BadRequestException('Push keys are required');
    }

    const existingByEndpoint = await this.pushSubscriptionRepo.findOne({
      where: { endpoint },
    });
    if (existingByEndpoint && existingByEndpoint.userId !== input.userId) {
      throw new ConflictException(
        'Push endpoint is already associated with another account',
      );
    }

    if (existingByEndpoint) {
      existingByEndpoint.workspaceId = workspaceId;
      existingByEndpoint.p256dh = p256dh;
      existingByEndpoint.auth = auth;
      existingByEndpoint.userAgent = userAgent;
      existingByEndpoint.isActive = true;
      existingByEndpoint.lastFailureAt = null;
      existingByEndpoint.failureCount = 0;
      return this.pushSubscriptionRepo.save(existingByEndpoint);
    }

    await this.enforcePushSubscriptionLimit(input.userId);
    const created = this.pushSubscriptionRepo.create({
      userId: input.userId,
      endpoint,
      p256dh,
      auth,
      workspaceId,
      userAgent,
      isActive: true,
      failureCount: 0,
      lastDeliveredAt: null,
      lastFailureAt: null,
    });
    return this.pushSubscriptionRepo.save(created);
  }

  async unregisterPushSubscription(input: {
    userId: string;
    endpoint: string;
  }): Promise<boolean> {
    const endpoint = String(input.endpoint || '').trim();
    if (!endpoint) return false;
    const existing = await this.pushSubscriptionRepo.findOne({
      where: { endpoint, userId: input.userId },
    });
    if (!existing) return false;
    if (!existing.isActive) return true;
    existing.isActive = false;
    await this.pushSubscriptionRepo.save(existing);
    return true;
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

  async getUnreadCount(
    userId: string,
    workspaceId?: string | null,
  ): Promise<number> {
    const normalizedWorkspaceId = String(workspaceId || '').trim();
    const whereClause = normalizedWorkspaceId
      ? [
          { userId, isRead: false, workspaceId: normalizedWorkspaceId },
          { userId, isRead: false, workspaceId: IsNull() },
        ]
      : { userId, isRead: false };
    return this.notificationRepo.count({
      where: whereClause,
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
    const savedNotification = await this.notificationRepo.save(notification);
    this.publishRealtimeEvent({
      eventType: 'NOTIFICATIONS_MARKED_READ',
      userId: savedNotification.userId,
      workspaceId: savedNotification.workspaceId || null,
      markedCount: 1,
    });
    await this.notificationWebhookService.dispatchNotificationsMarkedRead({
      userId: savedNotification.userId,
      workspaceId: savedNotification.workspaceId || null,
      markedCount: 1,
    });
    return savedNotification;
  }

  async markNotificationsRead(input: {
    userId: string;
    workspaceId?: string | null;
    sinceHours?: number | null;
    types?: string[] | null;
  }): Promise<number> {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const normalizedTypes = (input.types || [])
      .map((type) =>
        String(type || '')
          .trim()
          .toUpperCase(),
      )
      .filter((type) => type.length > 0);
    const normalizedSinceHours =
      typeof input.sinceHours === 'number' && Number.isFinite(input.sinceHours)
        ? Math.max(1, Math.min(24 * 30, Math.floor(input.sinceHours)))
        : null;
    const updateQuery = this.notificationRepo
      .createQueryBuilder()
      .update(UserNotification)
      .set({ isRead: true })
      .where('userId = :userId', { userId: input.userId })
      .andWhere('isRead = :isRead', { isRead: false });
    if (normalizedTypes.length) {
      updateQuery.andWhere('type IN (:...types)', { types: normalizedTypes });
    }
    if (normalizedWorkspaceId) {
      updateQuery.andWhere(
        '(workspaceId = :workspaceId OR workspaceId IS NULL)',
        { workspaceId: normalizedWorkspaceId },
      );
    }
    if (normalizedSinceHours !== null) {
      updateQuery.andWhere('createdAt >= :windowStart', {
        windowStart: new Date(
          Date.now() - normalizedSinceHours * 60 * 60 * 1000,
        ).toISOString(),
      });
    }
    const result = await updateQuery.execute();
    const affectedCount = Number(result.affected || 0);
    if (affectedCount > 0) {
      this.publishRealtimeEvent({
        eventType: 'NOTIFICATIONS_MARKED_READ',
        userId: input.userId,
        workspaceId: normalizedWorkspaceId || null,
        markedCount: affectedCount,
      });
      await this.notificationWebhookService.dispatchNotificationsMarkedRead({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId || null,
        markedCount: affectedCount,
      });
    }
    return affectedCount;
  }

  private resolveNotificationRetentionPolicy(): {
    notificationRetentionDays: number;
    disabledPushRetentionDays: number;
  } {
    const notificationRetentionDays = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_NOTIFICATION_RETENTION_DAYS,
      fallbackValue: 180,
      minimumValue: 7,
      maximumValue: 3650,
    });
    const disabledPushRetentionDays = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_NOTIFICATION_PUSH_RETENTION_DAYS,
      fallbackValue: 90,
      minimumValue: 7,
      maximumValue: 3650,
    });
    return {
      notificationRetentionDays,
      disabledPushRetentionDays,
    };
  }

  async exportNotificationData(input: {
    userId: string;
    limit?: number;
  }): Promise<NotificationDataExportResponse> {
    const generatedAt = new Date();
    const notificationLimit = this.resolvePositiveInteger({
      rawValue: input.limit,
      fallbackValue: 200,
      minimumValue: 1,
      maximumValue: 1000,
    });

    const [preferences, notifications, pushSubscriptions] = await Promise.all([
      this.getOrCreatePreferences(input.userId),
      this.listNotificationsForUser({
        userId: input.userId,
        limit: notificationLimit,
        unreadOnly: false,
        workspaceId: null,
        sinceHours: null,
        types: [],
      }),
      this.pushSubscriptionRepo.find({
        where: { userId: input.userId },
        order: { updatedAt: 'DESC' },
        take: 100,
      }),
    ]);

    const unreadCount = notifications.filter(
      (notification) => !notification.isRead,
    ).length;
    const retentionPolicy = this.resolveNotificationRetentionPolicy();
    const payload = {
      userId: input.userId,
      generatedAtIso: generatedAt.toISOString(),
      preferences: {
        inAppEnabled: preferences.inAppEnabled,
        emailEnabled: preferences.emailEnabled,
        pushEnabled: preferences.pushEnabled,
        syncFailureEnabled: preferences.syncFailureEnabled,
        mailboxInboundAcceptedEnabled:
          preferences.mailboxInboundAcceptedEnabled,
        mailboxInboundDeduplicatedEnabled:
          preferences.mailboxInboundDeduplicatedEnabled,
        mailboxInboundRejectedEnabled:
          preferences.mailboxInboundRejectedEnabled,
        mailboxInboundSlaAlertsEnabled:
          preferences.mailboxInboundSlaAlertsEnabled,
        notificationDigestEnabled: preferences.notificationDigestEnabled,
        mailboxInboundSlaAlertCooldownMinutes:
          preferences.mailboxInboundSlaAlertCooldownMinutes,
      },
      notificationSummary: {
        total: notifications.length,
        unread: unreadCount,
      },
      notifications: notifications.map((notification) => ({
        id: notification.id,
        workspaceId: notification.workspaceId || null,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAtIso: notification.createdAt.toISOString(),
        updatedAtIso: notification.updatedAt.toISOString(),
      })),
      pushSubscriptions: pushSubscriptions.map((subscription) => ({
        id: subscription.id,
        endpoint: subscription.endpoint,
        workspaceId: subscription.workspaceId || null,
        isActive: subscription.isActive,
        failureCount: subscription.failureCount,
        lastDeliveredAtIso: subscription.lastDeliveredAt
          ? subscription.lastDeliveredAt.toISOString()
          : null,
        lastFailureAtIso: subscription.lastFailureAt
          ? subscription.lastFailureAt.toISOString()
          : null,
        updatedAtIso: subscription.updatedAt.toISOString(),
      })),
      retentionPolicy,
    };

    return {
      generatedAtIso: generatedAt.toISOString(),
      dataJson: JSON.stringify(payload),
    };
  }

  async purgeNotificationRetentionData(
    input: {
      notificationRetentionDays?: number;
      disabledPushRetentionDays?: number;
    } = {},
  ): Promise<NotificationRetentionPurgeResponse> {
    const policy = this.resolveNotificationRetentionPolicy();
    const notificationRetentionDays = this.resolvePositiveInteger({
      rawValue: input.notificationRetentionDays,
      fallbackValue: policy.notificationRetentionDays,
      minimumValue: 7,
      maximumValue: 3650,
    });
    const disabledPushRetentionDays = this.resolvePositiveInteger({
      rawValue: input.disabledPushRetentionDays,
      fallbackValue: policy.disabledPushRetentionDays,
      minimumValue: 7,
      maximumValue: 3650,
    });

    const now = new Date();
    const notificationCutoffDate = new Date(
      now.getTime() - notificationRetentionDays * 24 * 60 * 60 * 1000,
    );
    const disabledPushCutoffDate = new Date(
      now.getTime() - disabledPushRetentionDays * 24 * 60 * 60 * 1000,
    );

    const notificationsDelete = await this.notificationRepo
      .createQueryBuilder()
      .delete()
      .from(UserNotification)
      .where('"createdAt" < :cutoff', {
        cutoff: notificationCutoffDate.toISOString(),
      })
      .andWhere('"isRead" = :isRead', { isRead: true })
      .execute();

    const pushSubscriptionsDelete = await this.pushSubscriptionRepo
      .createQueryBuilder()
      .delete()
      .from(NotificationPushSubscription)
      .where('"updatedAt" < :cutoff', {
        cutoff: disabledPushCutoffDate.toISOString(),
      })
      .andWhere('"isActive" = :isActive', { isActive: false })
      .execute();

    const notificationsDeleted = Number(notificationsDelete.affected || 0);
    const pushSubscriptionsDeleted = Number(
      pushSubscriptionsDelete.affected || 0,
    );
    const executedAtIso = now.toISOString();

    return {
      notificationsDeleted,
      pushSubscriptionsDeleted,
      notificationRetentionDays,
      disabledPushRetentionDays,
      executedAtIso,
    };
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

  async getMailboxInboundSlaIncidentSeries(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<
    Array<{
      bucketStart: Date;
      totalCount: number;
      warningCount: number;
      criticalCount: number;
    }>
  > {
    const normalizedWorkspaceId = String(input.workspaceId || '').trim();
    const windowHours = this.normalizeIncidentWindowHours(input.windowHours);
    const bucketMinutes = this.normalizeIncidentBucketMinutes(
      input.bucketMinutes,
    );
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const baseWhere = {
      userId: input.userId,
      type: 'MAILBOX_INBOUND_SLA_ALERT',
      createdAt: MoreThanOrEqual(windowStartDate),
    };
    const whereClause = normalizedWorkspaceId
      ? [
          { ...baseWhere, workspaceId: normalizedWorkspaceId },
          { ...baseWhere, workspaceId: IsNull() },
        ]
      : baseWhere;

    const notifications = await this.notificationRepo.find({
      where: whereClause,
      order: { createdAt: 'ASC' },
    });
    const bucketSizeMs = bucketMinutes * 60 * 1000;
    const nowMs = Date.now();
    const windowStartMs =
      Math.floor(windowStartDate.getTime() / bucketSizeMs) * bucketSizeMs;
    const bucketAccumulator = new Map<
      number,
      { totalCount: number; warningCount: number; criticalCount: number }
    >();
    for (const notification of notifications) {
      const bucketStartMs =
        Math.floor(notification.createdAt.getTime() / bucketSizeMs) *
        bucketSizeMs;
      const currentBucket = bucketAccumulator.get(bucketStartMs) || {
        totalCount: 0,
        warningCount: 0,
        criticalCount: 0,
      };
      currentBucket.totalCount += 1;
      const status = this.resolveIncidentSlaStatus(notification);
      if (status === 'CRITICAL') {
        currentBucket.criticalCount += 1;
      } else if (status === 'WARNING') {
        currentBucket.warningCount += 1;
      }
      bucketAccumulator.set(bucketStartMs, currentBucket);
    }

    const series: Array<{
      bucketStart: Date;
      totalCount: number;
      warningCount: number;
      criticalCount: number;
    }> = [];
    for (let cursor = windowStartMs; cursor <= nowMs; cursor += bucketSizeMs) {
      const bucketData = bucketAccumulator.get(cursor) || {
        totalCount: 0,
        warningCount: 0,
        criticalCount: 0,
      };
      series.push({
        bucketStart: new Date(cursor),
        totalCount: bucketData.totalCount,
        warningCount: bucketData.warningCount,
        criticalCount: bucketData.criticalCount,
      });
    }
    return series;
  }

  async exportMailboxInboundSlaIncidentData(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<{
    generatedAtIso: string;
    dataJson: string;
  }> {
    const normalizedWorkspaceId =
      String(input.workspaceId || '').trim() || null;
    const windowHours = this.normalizeIncidentWindowHours(input.windowHours);
    const bucketMinutes = this.normalizeIncidentBucketMinutes(
      input.bucketMinutes,
    );
    const [stats, series] = await Promise.all([
      this.getMailboxInboundSlaIncidentStats({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        windowHours,
      }),
      this.getMailboxInboundSlaIncidentSeries({
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        windowHours,
        bucketMinutes,
      }),
    ]);
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        workspaceId: normalizedWorkspaceId,
        windowHours,
        bucketMinutes,
        stats: {
          ...stats,
          lastAlertAtIso: stats.lastAlertAt
            ? stats.lastAlertAt.toISOString()
            : null,
        },
        series: series.map((point) => ({
          bucketStartIso: point.bucketStart.toISOString(),
          totalCount: point.totalCount,
          warningCount: point.warningCount,
          criticalCount: point.criticalCount,
        })),
      }),
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

  private normalizeIncidentBucketMinutes(
    bucketMinutes?: number | null,
  ): number {
    const candidate =
      typeof bucketMinutes === 'number' && Number.isFinite(bucketMinutes)
        ? Math.floor(bucketMinutes)
        : NotificationService.DEFAULT_MAILBOX_INBOUND_INCIDENT_BUCKET_MINUTES;
    if (
      candidate <
      NotificationService.MIN_MAILBOX_INBOUND_INCIDENT_BUCKET_MINUTES
    ) {
      return NotificationService.MIN_MAILBOX_INBOUND_INCIDENT_BUCKET_MINUTES;
    }
    if (
      candidate >
      NotificationService.MAX_MAILBOX_INBOUND_INCIDENT_BUCKET_MINUTES
    ) {
      return NotificationService.MAX_MAILBOX_INBOUND_INCIDENT_BUCKET_MINUTES;
    }
    return candidate;
  }

  private resolveIncidentSlaStatus(
    notification: UserNotification,
  ): 'WARNING' | 'CRITICAL' | null {
    const rawStatus = notification.metadata?.slaStatus;
    if (typeof rawStatus !== 'string') return null;
    const normalizedStatus = rawStatus.trim().toUpperCase();
    if (normalizedStatus === 'WARNING') return 'WARNING';
    if (normalizedStatus === 'CRITICAL') return 'CRITICAL';
    return null;
  }

  private async enforcePushSubscriptionLimit(userId: string): Promise<void> {
    const maxSubscriptions = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_WEB_PUSH_MAX_SUBSCRIPTIONS_PER_USER,
      fallbackValue: 8,
      minimumValue: 1,
      maximumValue: 100,
    });
    const activeSubscriptions = await this.pushSubscriptionRepo.find({
      where: {
        userId,
        isActive: true,
      },
      order: { updatedAt: 'ASC' },
      take: maxSubscriptions,
    });
    if (activeSubscriptions.length < maxSubscriptions) return;

    const oldestActive = activeSubscriptions[0];
    if (!oldestActive) return;
    oldestActive.isActive = false;
    await this.pushSubscriptionRepo.save(oldestActive);
  }

  private resolvePositiveInteger(input: {
    rawValue?: string | number;
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

  private publishRealtimeEvent(
    eventInput: Omit<NotificationRealtimeEvent, 'createdAtIso'>,
  ): void {
    this.realtimeEventBus.next({
      ...eventInput,
      createdAtIso: new Date().toISOString(),
    });
  }
}
