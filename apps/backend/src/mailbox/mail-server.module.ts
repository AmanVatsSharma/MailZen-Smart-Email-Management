import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { MailServerService } from './mail-server.service';
import { Mailbox } from './entities/mailbox.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Mailbox, AuditLog])],
  providers: [MailServerService],
  exports: [MailServerService],
})
export class MailServerModule {}
