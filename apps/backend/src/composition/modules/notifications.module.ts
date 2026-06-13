// apps/backend/src/composition/modules/notifications.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { TrackingPixelOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/tracking-pixel.orm-entity';
import { TrackingLinkOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/tracking-link.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationOrmEntity, TrackingPixelOrmEntity, TrackingLinkOrmEntity])],
  exports: [TypeOrmModule],
})
export class NotificationsModule {}
