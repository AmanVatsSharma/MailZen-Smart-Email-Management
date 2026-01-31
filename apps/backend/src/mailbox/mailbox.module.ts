import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailboxService } from './mailbox.service';
import { MailboxResolver } from './mailbox.resolver';
import { MailServerModule } from './mail-server.module';

@Module({
  imports: [PrismaModule, MailServerModule],
  providers: [MailboxService, MailboxResolver],
  exports: [MailboxService],
})
export class MailboxModule {}
