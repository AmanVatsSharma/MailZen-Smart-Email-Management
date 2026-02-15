import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mailbox } from './entities/mailbox.entity';
import { MailboxService } from './mailbox.service';
import { MailboxResolver } from './mailbox.resolver';
import { MailboxInboundService } from './mailbox-inbound.service';
import { MailboxInboundController } from './mailbox-inbound.controller';
import { BillingModule } from '../billing/billing.module';
import { User } from '../user/entities/user.entity';
import { MailServerModule } from './mail-server.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { Email } from '../email/entities/email.entity';
import { NotificationModule } from '../notification/notification.module';
import { MailboxInboundEvent } from './entities/mailbox-inbound-event.entity';
import { UserNotificationPreference } from '../notification/entities/user-notification-preference.entity';

/**
 * MailboxModule - Self-hosted mailbox management
 * Handles mailzen.com mailbox operations
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Mailbox,
      User,
      Email,
      MailboxInboundEvent,
      UserNotificationPreference,
    ]),
    MailServerModule,
    BillingModule,
    WorkspaceModule,
    NotificationModule,
  ],
  controllers: [MailboxInboundController],
  providers: [MailboxService, MailboxResolver, MailboxInboundService],
  exports: [MailboxService],
})
export class MailboxModule {}
