import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserNotification } from './entities/user-notification.entity';

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
  ) {}

  async createNotification(
    input: CreateNotificationInput,
  ): Promise<UserNotification> {
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
