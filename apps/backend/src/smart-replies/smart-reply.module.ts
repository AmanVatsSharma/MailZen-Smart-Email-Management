import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyResolver } from './smart-reply.resolver';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';
import { SmartReplyModelProvider } from './smart-reply-model.provider';

@Module({
  imports: [TypeOrmModule.forFeature([SmartReplySettings])],
  providers: [
    SmartReplyService,
    SmartReplyResolver,
    SmartReplyModelProvider,
    SmartReplyExternalModelAdapter,
  ],
  exports: [SmartReplyService],
})
export class SmartReplyModule {}
