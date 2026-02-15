import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as webpush from 'web-push';
import { IsNull, Repository } from 'typeorm';
import { NotificationPushSubscription } from './entities/notification-push-subscription.entity';
import { UserNotification } from './entities/user-notification.entity';

@Injectable()
export class NotificationPushService {
  private readonly logger = new Logger(NotificationPushService.name);
  private vapidConfigured = false;

  constructor(
    @InjectRepository(NotificationPushSubscription)
    private readonly subscriptionRepo: Repository<NotificationPushSubscription>,
  ) {}

  async dispatchNotificationCreated(
    notification: UserNotification,
  ): Promise<void> {
    if (!this.isPushEnabled()) return;
    const vapid = this.resolveVapidConfig();
    if (!vapid) return;
    this.configureWebPush(vapid);

    const subscriptions = await this.resolveTargetSubscriptions(notification);
    if (!subscriptions.length) return;

    const payload = JSON.stringify({
      eventType: 'NOTIFICATION_CREATED',
      notificationId: notification.id,
      notificationType: notification.type,
      title: notification.title,
      message: notification.message,
      workspaceId: notification.workspaceId || null,
      createdAtIso:
        notification.createdAt?.toISOString() || new Date().toISOString(),
    });

    await Promise.all(
      subscriptions.map((subscription) =>
        this.deliverPushNotification({
          subscription,
          payload,
        }),
      ),
    );
  }

  private async deliverPushNotification(input: {
    subscription: NotificationPushSubscription;
    payload: string;
  }): Promise<void> {
    const maxFailuresBeforeDisable = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_WEB_PUSH_MAX_FAILURE_COUNT,
      fallbackValue: 8,
      minimumValue: 1,
      maximumValue: 100,
    });
    try {
      await webpush.sendNotification(
        {
          endpoint: input.subscription.endpoint,
          keys: {
            p256dh: input.subscription.p256dh,
            auth: input.subscription.auth,
          },
        },
        input.payload,
      );
      input.subscription.failureCount = 0;
      input.subscription.lastDeliveredAt = new Date();
      input.subscription.lastFailureAt = null;
      input.subscription.isActive = true;
      await this.subscriptionRepo.save(input.subscription);
    } catch (error: unknown) {
      const statusCode = this.resolveStatusCode(error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      input.subscription.failureCount =
        Number(input.subscription.failureCount || 0) + 1;
      input.subscription.lastFailureAt = new Date();
      const shouldDisable =
        statusCode === 404 ||
        statusCode === 410 ||
        input.subscription.failureCount >= maxFailuresBeforeDisable;
      if (shouldDisable) {
        input.subscription.isActive = false;
      }
      await this.subscriptionRepo.save(input.subscription);
      this.logger.warn(
        `notification-push: delivery failed userId=${input.subscription.userId} status=${statusCode || 'unknown'} endpoint=${this.compactEndpoint(input.subscription.endpoint)} disabled=${shouldDisable} error=${errorMessage}`,
      );
    }
  }

  private async resolveTargetSubscriptions(
    notification: UserNotification,
  ): Promise<NotificationPushSubscription[]> {
    const workspaceId = String(notification.workspaceId || '').trim();
    if (!workspaceId) {
      return this.subscriptionRepo.find({
        where: {
          userId: notification.userId,
          isActive: true,
        },
      });
    }

    return this.subscriptionRepo.find({
      where: [
        {
          userId: notification.userId,
          isActive: true,
          workspaceId,
        },
        {
          userId: notification.userId,
          isActive: true,
          workspaceId: IsNull(),
        },
      ],
    });
  }

  private resolveStatusCode(error: unknown): number | null {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number'
    ) {
      return (error as { statusCode: number }).statusCode;
    }
    return null;
  }

  private compactEndpoint(endpoint: string): string {
    const normalized = String(endpoint || '').trim();
    if (normalized.length <= 18) return normalized;
    return `${normalized.slice(0, 12)}...${normalized.slice(-6)}`;
  }

  private configureWebPush(input: {
    publicKey: string;
    privateKey: string;
    subject: string;
  }): void {
    if (this.vapidConfigured) return;
    webpush.setVapidDetails(input.subject, input.publicKey, input.privateKey);
    this.vapidConfigured = true;
  }

  private isPushEnabled(): boolean {
    return (
      String(process.env.MAILZEN_WEB_PUSH_ENABLED || 'false')
        .trim()
        .toLowerCase() === 'true'
    );
  }

  private resolveVapidConfig(): {
    publicKey: string;
    privateKey: string;
    subject: string;
  } | null {
    const publicKey = String(
      process.env.MAILZEN_WEB_PUSH_VAPID_PUBLIC_KEY || '',
    ).trim();
    const privateKey = String(
      process.env.MAILZEN_WEB_PUSH_VAPID_PRIVATE_KEY || '',
    ).trim();
    const subject = String(
      process.env.MAILZEN_WEB_PUSH_VAPID_SUBJECT || 'mailto:alerts@mailzen.com',
    ).trim();
    if (!publicKey || !privateKey) {
      this.logger.warn(
        'notification-push: missing VAPID keys, push delivery skipped',
      );
      return null;
    }
    return {
      publicKey,
      privateKey,
      subject,
    };
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
