import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplyResolver } from './smart-reply.resolver';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SmartReplySettings])],
  providers: [SmartReplyService, SmartReplyResolver],
  exports: [SmartReplyService],
})
export class SmartReplyModule {}
