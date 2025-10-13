import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailboxService } from './mailbox.service';
import { MailboxResolver } from './mailbox.resolver';

@Module({
  imports: [PrismaModule],
  providers: [MailboxService, MailboxResolver],
  exports: [MailboxService],
})
export class MailboxModule {}
