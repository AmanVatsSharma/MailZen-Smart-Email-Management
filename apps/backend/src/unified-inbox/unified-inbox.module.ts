import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UnifiedInboxResolver } from './unified-inbox.resolver';
import { UnifiedInboxService } from './unified-inbox.service';

@Module({
  imports: [PrismaModule],
  providers: [UnifiedInboxResolver, UnifiedInboxService],
  exports: [UnifiedInboxService],
})
export class UnifiedInboxModule {}

