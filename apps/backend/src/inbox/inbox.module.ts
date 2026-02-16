import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { User } from '../user/entities/user.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { InboxService } from './inbox.service';
import { InboxResolver } from './inbox.resolver';
import { MailboxModule } from '../mailbox/mailbox.module';
import { EmailProviderModule } from '../email-integration/email-provider.module';

/**
 * InboxModule - Unified inbox management
 * Handles inbox switching between mailboxes and providers
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Mailbox, EmailProvider, AuditLog]),
    MailboxModule,
    EmailProviderModule,
  ],
  providers: [InboxService, InboxResolver],
  exports: [InboxService],
})
export class InboxModule {}
