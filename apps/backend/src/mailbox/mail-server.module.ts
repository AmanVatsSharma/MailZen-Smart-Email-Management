import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailServerService } from './mail-server.service';
import { Mailbox } from './entities/mailbox.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Mailbox])],
  providers: [MailServerService],
  exports: [MailServerService],
})
export class MailServerModule {}
