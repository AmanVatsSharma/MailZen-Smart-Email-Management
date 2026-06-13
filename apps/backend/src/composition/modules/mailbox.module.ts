// apps/backend/src/composition/modules/mailbox.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { MailboxOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/mailbox.orm-entity';
import { EmailProviderOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/email-provider.orm-entity';
import { InboxFolderOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/inbox-folder.orm-entity';
import { UnifiedThreadOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/unified-thread.orm-entity';
import { BullJobQueue } from '../../core/infrastructure/queues/bull/bull-job-queue';
import { JOB_QUEUE } from '../../core/application/ports/queue/job-queue';

@Module({
  imports: [
    TypeOrmModule.forFeature([MailboxOrmEntity, EmailProviderOrmEntity, InboxFolderOrmEntity, UnifiedThreadOrmEntity]),
    BullModule.registerQueue({ name: 'sync' }),
  ],
  providers: [{ provide: JOB_QUEUE, useClass: BullJobQueue }],
  exports: [JOB_QUEUE, TypeOrmModule],
})
export class MailboxModule {}
