import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mailbox } from './entities/mailbox.entity';
import { MailboxService } from './mailbox.service';
import { MailboxResolver } from './mailbox.resolver';
import { BillingModule } from '../billing/billing.module';
import { User } from '../user/entities/user.entity';
import { MailServerModule } from './mail-server.module';
import { WorkspaceModule } from '../workspace/workspace.module';

/**
 * MailboxModule - Self-hosted mailbox management
 * Handles mailzen.com mailbox operations
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Mailbox, User]),
    MailServerModule,
    BillingModule,
    WorkspaceModule,
  ],
  providers: [MailboxService, MailboxResolver],
  exports: [MailboxService],
})
export class MailboxModule {}
