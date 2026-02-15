import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEventBusService } from './notification-event-bus.service';
import { User } from '../user/entities/user.entity';
import { NotificationStreamController } from './notification-stream.controller';
import { UserNotificationPreference } from './entities/user-notification-preference.entity';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationDigestScheduler } from './notification-digest.scheduler';
import { NotificationResolver } from './notification.resolver';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserNotification,
      UserNotificationPreference,
      User,
    ]),
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      },
      defaults: {
        from: '"MailZen" <noreply@mailzen.com>',
      },
    }),
  ],
  controllers: [NotificationStreamController],
  providers: [
    NotificationService,
    NotificationEventBusService,
    NotificationDigestScheduler,
    NotificationResolver,
  ],
  exports: [NotificationService, NotificationEventBusService],
})
export class NotificationModule {}
