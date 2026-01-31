import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mailbox } from './entities/mailbox.entity';
import { MailboxService } from './mailbox.service';
import { MailboxResolver } from './mailbox.resolver';

/**
 * MailboxModule - Self-hosted mailbox management
 * Handles mailzen.com mailbox operations
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Mailbox]),
  ],
  providers: [MailboxService, MailboxResolver],
  exports: [MailboxService],
})
export class MailboxModule {}
