// apps/backend/src/composition/modules/ai.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SmartReplyOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/smart-reply.orm-entity';
import { TriageResultOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/triage-result.orm-entity';
import { SenderProfileOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/sender-profile.orm-entity';
import { HttpAiGateway } from '../../core/infrastructure/external-services/ai/http-ai.gateway';
import { AI_GATEWAY } from '../../core/application/ports/gateways/ai.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmartReplyOrmEntity, TriageResultOrmEntity, SenderProfileOrmEntity]),
    HttpModule.register({ baseURL: process.env.AI_GATEWAY_URL ?? 'http://localhost:4001' }),
  ],
  providers: [{ provide: AI_GATEWAY, useClass: HttpAiGateway }],
  exports: [AI_GATEWAY, TypeOrmModule],
})
export class AiModule {}
