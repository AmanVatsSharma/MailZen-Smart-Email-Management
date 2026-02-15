import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEventBusService } from './notification-event-bus.service';
import { NotificationStreamController } from './notification-stream.controller';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationResolver } from './notification.resolver';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserNotification, UserNotificationPreference]),
  ],
  controllers: [NotificationStreamController],
  providers: [
    NotificationService,
    NotificationEventBusService,
    NotificationResolver,
  ],
  exports: [NotificationService, NotificationEventBusService],
})
export class NotificationModule {}
