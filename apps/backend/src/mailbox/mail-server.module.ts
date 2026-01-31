import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailServerService } from './mail-server.service';

@Module({
  imports: [PrismaModule],
  providers: [MailServerService],
  exports: [MailServerService],
})
export class MailServerModule {}
