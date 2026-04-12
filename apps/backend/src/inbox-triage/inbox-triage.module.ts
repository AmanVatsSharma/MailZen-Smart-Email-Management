import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { AiAgentGatewayModule } from '../ai-agent-gateway/ai-agent-gateway.module';
import { NotificationModule } from '../notification/notification.module';
import { InboxTriageService } from './inbox-triage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalEmailMessage]),
    AiAgentGatewayModule,
    NotificationModule,
  ],
  providers: [InboxTriageService],
})
export class InboxTriageModule {}
