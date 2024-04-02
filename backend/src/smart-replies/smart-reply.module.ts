import { Module } from '@nestjs/common';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplyResolver } from './smart-reply.resolver';

@Module({
  providers: [SmartReplyService, SmartReplyResolver],
  exports: [SmartReplyService],
})
export class SmartReplyModule {}