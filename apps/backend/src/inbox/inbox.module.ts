import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InboxResolver } from './inbox.resolver';
import { InboxService } from './inbox.service';

@Module({
  imports: [PrismaModule],
  providers: [InboxResolver, InboxService],
  exports: [InboxService],
})
export class InboxModule {}

