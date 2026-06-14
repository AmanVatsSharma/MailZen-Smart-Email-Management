// apps/backend/src/composition/modules/billing.module.ts
// Composition for the billing bounded context (plans, subscriptions, AI credits).

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/plan.orm-entity';
import { SubscriptionOrmEntity } from '../../core/infrastructure/persistence/typeorm/entities/subscription.orm-entity';
import { TypeOrmPlanRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-plan.repository';
import { TypeOrmSubscriptionRepository } from '../../core/infrastructure/persistence/typeorm/repositories/typeorm-subscription.repository';
import { PLAN_REPOSITORY } from '../../core/application/ports/repositories/plan.repository';
import { SUBSCRIPTION_REPOSITORY } from '../../core/application/ports/repositories/subscription.repository';
import { PAYMENT_GATEWAY } from '../../core/application/ports/gateways/payment.gateway';
import { ListPlansHandler } from '../../core/application/use-cases/billing/list-plans/list-plans.handler';
import { GetPlanHandler } from '../../core/application/use-cases/billing/get-plan/get-plan.handler';
import { SubscribeHandler } from '../../core/application/use-cases/billing/subscribe/subscribe.handler';
import { CancelSubscriptionHandler } from '../../core/application/use-cases/billing/cancel-subscription/cancel-subscription.handler';
import { GetActiveSubscriptionHandler } from '../../core/application/use-cases/billing/get-active-subscription/get-active-subscription.handler';
import { HandleStripeWebhookHandler } from '../../core/application/use-cases/billing/handle-stripe-webhook/handle-stripe-webhook.handler';
import { BurnAiCreditsHandler } from '../../core/application/use-cases/billing/burn-ai-credits/burn-ai-credits.handler';
import { GetAiCreditBalanceHandler } from '../../core/application/use-cases/billing/get-ai-credit-balance/get-ai-credit-balance.handler';
import { StripePaymentGateway } from '../../core/infrastructure/external-services/payment/stripe-payment.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlanOrmEntity, SubscriptionOrmEntity]),
  ],
  providers: [
    { provide: PLAN_REPOSITORY, useClass: TypeOrmPlanRepository },
    { provide: SUBSCRIPTION_REPOSITORY, useClass: TypeOrmSubscriptionRepository },
    { provide: PAYMENT_GATEWAY, useClass: StripePaymentGateway },
    ListPlansHandler,
    GetPlanHandler,
    SubscribeHandler,
    CancelSubscriptionHandler,
    GetActiveSubscriptionHandler,
    HandleStripeWebhookHandler,
    BurnAiCreditsHandler,
    GetAiCreditBalanceHandler,
  ],
  exports: [
    PLAN_REPOSITORY,
    SUBSCRIPTION_REPOSITORY,
    PAYMENT_GATEWAY,
    TypeOrmModule,
  ],
})
export class BillingModule {}
