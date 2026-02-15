import { Injectable, Logger } from '@nestjs/common';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationService } from './notification.service';

export type NotificationDomainEvent = {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationEventBusService {
  private readonly logger = new Logger(NotificationEventBusService.name);

  constructor(private readonly notificationService: NotificationService) {}

  async publish(event: NotificationDomainEvent): Promise<UserNotification> {
    return this.notificationService.createNotification(event);
  }

  async publishSafely(
    event: NotificationDomainEvent,
  ): Promise<UserNotification | null> {
    try {
      return await this.publish(event);
    } catch (error: unknown) {
      this.logger.warn(
        `notification-event-bus: failed to publish event type=${event.type} userId=${event.userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
