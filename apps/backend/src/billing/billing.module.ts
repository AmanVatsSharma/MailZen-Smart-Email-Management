import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { Mailbox } from '../mailbox/entities/mailbox.entity';
import { BillingRetentionScheduler } from './billing-retention.scheduler';
import { NotificationModule } from '../notification/notification.module';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingResolver } from './billing.resolver';
import { BillingService } from './billing.service';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { BillingPlan } from './entities/billing-plan.entity';
import { UserAiCreditUsage } from './entities/user-ai-credit-usage.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { WorkspaceMember } from '../workspace/entities/workspace-member.entity';
import { Workspace } from '../workspace/entities/workspace.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingPlan,
      UserSubscription,
      UserAiCreditUsage,
      BillingInvoice,
      BillingWebhookEvent,
      EmailProvider,
      Mailbox,
      Workspace,
      WorkspaceMember,
    ]),
    NotificationModule,
  ],
  controllers: [BillingWebhookController],
  providers: [BillingService, BillingResolver, BillingRetentionScheduler],
  exports: [BillingService],
})
export class BillingModule {}
