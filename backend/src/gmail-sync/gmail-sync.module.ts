import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GmailSyncService } from './gmail-sync.service';
import { GmailSyncResolver } from './gmail-sync.resolver';
import { GmailSyncScheduler } from './gmail-sync.scheduler';

@Module({
  imports: [
    PrismaModule,
  ],
  providers: [GmailSyncService, GmailSyncResolver, GmailSyncScheduler],
  exports: [GmailSyncService],
})
export class GmailSyncModule {}

