// apps/backend/src/composition/modules/notifications.module.ts
// Composition for the notifications bounded context.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { TypeOrmNotificationRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-notification.repository';
import { NOTIFICATION_REPOSITORY } from '../../core/application/ports/repositories/notification.repository';
import { ListNotificationsHandler } from '../../core/application/use-cases/notifications/list-notifications/list-notifications.handler';
import { MarkNotificationReadHandler } from '../../core/application/use-cases/notifications/mark-read/mark-read.handler';
import { DispatchNotificationHandler } from '../../core/application/use-cases/notifications/dispatch-notification/dispatch-notification.handler';
import { PushNotificationGateway } from '../../core/infrastructure/external-services/push/push-notification.gateway';
import { PUSH_GATEWAY } from '../../core/application/ports/gateways/push.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationOrmEntity])],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: TypeOrmNotificationRepository },
    { provide: PUSH_GATEWAY, useClass: PushNotificationGateway },
    ListNotificationsHandler,
    MarkNotificationReadHandler,
    DispatchNotificationHandler,
  ],
  exports: [NOTIFICATION_REPOSITORY, PUSH_GATEWAY, TypeOrmModule],
})
export class NotificationsModule {}
