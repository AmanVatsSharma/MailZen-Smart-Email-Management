// apps/backend/src/composition/modules/ai.module.ts
// Composition for the AI bounded context (smart-replies, triage, sender-intelligence).

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SmartReplyOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/smart-reply.orm-entity';
import { TriageResultOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/triage-result.orm-entity';
import { SenderProfileOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/sender-profile.orm-entity';
import { TypeOrmSmartReplyRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-smart-reply.repository';
import { TypeOrmTriageResultRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-triage.repository';
import { TypeOrmSenderProfileRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-sender-profile.repository';
import { HttpAiGateway } from '../../core/infrastructure/external-services/ai/http-ai.gateway';
import { AI_GATEWAY } from '../../core/application/ports/gateways/ai.gateway';
import { AI_CREDIT_BURNER } from '../../core/application/ports/gateways/ai-credit-burner.gateway';
import { SMART_REPLY_REPOSITORY } from '../../core/application/ports/repositories/smart-reply.repository';
import { TRIAGE_RESULT_REPOSITORY } from '../../core/application/ports/repositories/triage-result.repository';
import { SENDER_PROFILE_REPOSITORY } from '../../core/application/ports/repositories/sender-profile.repository';
import { HttpAiCreditBurner } from '../../core/infrastructure/external-services/ai/http-ai-credit-burner.gateway';
import { GenerateSmartReplyHandler } from '../../core/application/use-cases/ai/generate-smart-reply/generate-smart-reply.handler';
import { AcceptSmartReplyHandler } from '../../core/application/use-cases/ai/accept-smart-reply/accept-smart-reply.handler';
import { RejectSmartReplyHandler } from '../../core/application/use-cases/ai/reject-smart-reply/reject-smart-reply.handler';
import { TriageInboxHandler } from '../../core/application/use-cases/ai/triage-inbox/triage-inbox.handler';
import { ListTriageResultsHandler } from '../../core/application/use-cases/ai/list-triage-results/list-triage-results.handler';
import { AnalyzeSenderHandler } from '../../core/application/use-cases/ai/analyze-sender/analyze-sender.handler';
import { GetSenderProfileHandler } from '../../core/application/use-cases/ai/get-sender-profile/get-sender-profile.handler';
import { ListAiUsageHandler } from '../../core/application/use-cases/ai/list-ai-usage/list-ai-usage.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmartReplyOrmEntity, TriageResultOrmEntity, SenderProfileOrmEntity]),
    HttpModule.register({ baseURL: process.env.AI_GATEWAY_URL ?? 'http://localhost:4001' }),
  ],
  providers: [
    // Port -> Adapter bindings
    { provide: AI_GATEWAY, useClass: HttpAiGateway },
    { provide: AI_CREDIT_BURNER, useClass: HttpAiCreditBurner },
    { provide: SMART_REPLY_REPOSITORY, useClass: TypeOrmSmartReplyRepository },
    { provide: TRIAGE_RESULT_REPOSITORY, useClass: TypeOrmTriageResultRepository },
    { provide: SENDER_PROFILE_REPOSITORY, useClass: TypeOrmSenderProfileRepository },
    // Use cases
    GenerateSmartReplyHandler,
    AcceptSmartReplyHandler,
    RejectSmartReplyHandler,
    TriageInboxHandler,
    ListTriageResultsHandler,
    AnalyzeSenderHandler,
    GetSenderProfileHandler,
    ListAiUsageHandler,
  ],
  exports: [
    AI_GATEWAY,
    AI_CREDIT_BURNER,
    SMART_REPLY_REPOSITORY,
    TRIAGE_RESULT_REPOSITORY,
    SENDER_PROFILE_REPOSITORY,
    TypeOrmModule,
  ],
})
export class AiModule {}
