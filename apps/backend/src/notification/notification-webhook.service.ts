import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHmac } from 'crypto';
import { UserNotification } from './entities/user-notification.entity';

type NotificationWebhookEventPayload = {
  eventType: 'NOTIFICATION_CREATED' | 'NOTIFICATIONS_MARKED_READ';
  occurredAtIso: string;
  data: Record<string, unknown>;
};

@Injectable()
export class NotificationWebhookService {
  private readonly logger = new Logger(NotificationWebhookService.name);

  async dispatchNotificationCreated(
    notification: UserNotification,
  ): Promise<void> {
    await this.dispatch({
      eventType: 'NOTIFICATION_CREATED',
      occurredAtIso: new Date().toISOString(),
      data: {
        id: notification.id,
        userId: notification.userId,
        workspaceId: notification.workspaceId || null,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        metadata: notification.metadata || null,
        createdAt: notification.createdAt?.toISOString() || null,
      },
    });
  }

  async dispatchNotificationsMarkedRead(input: {
    userId: string;
    workspaceId?: string | null;
    markedCount: number;
  }): Promise<void> {
    await this.dispatch({
      eventType: 'NOTIFICATIONS_MARKED_READ',
      occurredAtIso: new Date().toISOString(),
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId || null,
        markedCount: input.markedCount,
      },
    });
  }

  private async dispatch(
    payload: NotificationWebhookEventPayload,
  ): Promise<void> {
    const targetUrl = String(
      process.env.MAILZEN_NOTIFICATION_WEBHOOK_URL || '',
    ).trim();
    if (!targetUrl) return;

    const timeoutMs = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_NOTIFICATION_WEBHOOK_TIMEOUT_MS,
      fallbackValue: 3_000,
      minimumValue: 200,
      maximumValue: 60_000,
    });
    const retries = this.resolvePositiveInteger({
      rawValue: process.env.MAILZEN_NOTIFICATION_WEBHOOK_RETRIES,
      fallbackValue: 2,
      minimumValue: 0,
      maximumValue: 10,
    });
    const token = String(
      process.env.MAILZEN_NOTIFICATION_WEBHOOK_TOKEN || '',
    ).trim();
    const signingKey = String(
      process.env.MAILZEN_NOTIFICATION_WEBHOOK_SIGNING_KEY || '',
    ).trim();
    const serializedPayload = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = signingKey
      ? createHmac('sha256', signingKey)
          .update(`${timestamp}.${serializedPayload}`)
          .digest('hex')
      : null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        await axios.post(targetUrl, payload, {
          timeout: timeoutMs,
          headers: {
            'content-type': 'application/json',
            'x-mailzen-notification-timestamp': timestamp,
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(signature
              ? { 'x-mailzen-notification-signature': signature }
              : {}),
          },
        });
        return;
      } catch (error: unknown) {
        const isLastAttempt = attempt >= retries;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (isLastAttempt) {
          this.logger.warn(
            `notification-webhook: failed dispatch event=${payload.eventType} attempts=${attempt + 1} error=${errorMessage}`,
          );
          return;
        }
        this.logger.warn(
          `notification-webhook: retry dispatch event=${payload.eventType} attempt=${attempt + 1} error=${errorMessage}`,
        );
        await this.sleep((attempt + 1) * 250);
      }
    }
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
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
