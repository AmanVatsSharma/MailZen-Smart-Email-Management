import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyResolver } from './smart-reply.resolver';
import { SmartReplyRetentionScheduler } from './smart-reply-retention.scheduler';
import { SmartReplyHistory } from './entities/smart-reply-history.entity';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyProviderRouter } from './smart-reply-provider.router';
import { SmartReplyAnthropicAdapter } from './smart-reply-anthropic.adapter';
import { SmartReplyOpenAiAdapter } from './smart-reply-openai.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([SmartReplySettings, SmartReplyHistory])],
  providers: [
    SmartReplyService,
    SmartReplyResolver,
    SmartReplyRetentionScheduler,
    SmartReplyModelProvider,
    SmartReplyOpenAiAdapter,
    SmartReplyAnthropicAdapter,
    SmartReplyExternalModelAdapter,
    SmartReplyProviderRouter,
  ],
  exports: [SmartReplyService],
})
export class SmartReplyModule {}
