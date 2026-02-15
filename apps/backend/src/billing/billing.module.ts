import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notification/notification.module';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingResolver } from './billing.resolver';
import { BillingService } from './billing.service';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { BillingPlan } from './entities/billing-plan.entity';
import { UserAiCreditUsage } from './entities/user-ai-credit-usage.entity';
import { UserSubscription } from './entities/user-subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingPlan,
      UserSubscription,
      UserAiCreditUsage,
      BillingInvoice,
      BillingWebhookEvent,
    ]),
    NotificationModule,
  ],
  controllers: [BillingWebhookController],
  providers: [BillingService, BillingResolver],
  exports: [BillingService],
})
export class BillingModule {}
