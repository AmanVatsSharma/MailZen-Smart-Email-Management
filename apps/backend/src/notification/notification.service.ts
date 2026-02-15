import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
    @InjectRepository(UserNotificationPreference)
    private readonly notificationPreferenceRepo: Repository<UserNotificationPreference>,
  ) {}

  private getDefaultPreference(userId: string): UserNotificationPreference {
    const row = this.notificationPreferenceRepo.create({
      userId,
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      syncFailureEnabled: true,
      mailboxInboundAcceptedEnabled: true,
      mailboxInboundDeduplicatedEnabled: false,
      mailboxInboundRejectedEnabled: true,
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
    return this.notificationPreferenceRepo.save(existing);
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

  async createNotification(
    input: CreateNotificationInput,
  ): Promise<UserNotification> {
    const preference = await this.getOrCreatePreferences(input.userId);
    if (!preference.inAppEnabled) {
      const muted = this.notificationRepo.create({
        userId: input.userId,
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
  }): Promise<UserNotification[]> {
    const limit = Math.max(1, Math.min(100, input.limit || 20));
    return this.notificationRepo.find({
      where: {
        userId: input.userId,
        ...(input.unreadOnly ? { isRead: false } : {}),
      },
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
}
