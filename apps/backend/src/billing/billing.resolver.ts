import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { AiCreditBalanceResponse } from './dto/ai-credit-balance.response';
import { BillingUpgradeIntentResponse } from './dto/billing-upgrade-intent.response';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { BillingPlan } from './entities/billing-plan.entity';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { UserSubscription } from './entities/user-subscription.entity';

interface RequestContext {
  req: {
    user: {
      id: string;
      role?: string;
    };
  };
}

@Resolver()
@UseGuards(JwtAuthGuard)
export class BillingResolver {
  constructor(private readonly billingService: BillingService) {}

  @Query(() => [BillingPlan], {
    description: 'List active billing plans',
  })
  async billingPlans() {
    return this.billingService.listPlans();
  }

  @Query(() => UserSubscription, {
    description: 'Get current authenticated user subscription',
  })
  async mySubscription(@Context() context: RequestContext) {
    return this.billingService.getMySubscription(context.req.user.id);
  }

  @Query(() => AiCreditBalanceResponse, {
    description: 'Get AI credit usage balance for current billing period',
  })
  async myAiCreditBalance(@Context() context: RequestContext) {
    return this.billingService.getAiCreditBalance(context.req.user.id);
  }

  @Query(() => [BillingInvoice], {
    description: 'List current authenticated user invoices',
  })
  async myBillingInvoices(
    @Args('limit', { nullable: true }) limit: number,
    @Context() context: RequestContext,
  ) {
    return this.billingService.listMyInvoices(context.req.user.id, limit);
  }

  @Mutation(() => UserSubscription, {
    description: 'Select an active plan for current user',
  })
  async selectMyPlan(
    @Args('planCode') planCode: string,
    @Context() context: RequestContext,
  ) {
    return this.billingService.selectPlan(context.req.user.id, planCode);
  }

  @Mutation(() => BillingUpgradeIntentResponse, {
    description: 'Record a plan-upgrade intent for current user',
  })
  async requestMyPlanUpgrade(
    @Args('targetPlanCode') targetPlanCode: string,
    @Args('note', { nullable: true }) note: string,
    @Context() context: RequestContext,
  ) {
    return this.billingService.requestUpgradeIntent(
      context.req.user.id,
      targetPlanCode,
      note,
    );
  }

  @Mutation(() => UserSubscription, {
    description: 'Start trial for an active paid plan',
  })
  async startMyPlanTrial(
    @Args('planCode') planCode: string,
    @Args('trialDays', { nullable: true }) trialDays: number,
    @Context() context: RequestContext,
  ) {
    return this.billingService.startPlanTrial(
      context.req.user.id,
      planCode,
      trialDays,
    );
  }

  @Mutation(() => BillingWebhookEvent, {
    description:
      'Ingest provider billing webhook payload (admin-only replay endpoint)',
  })
  @UseGuards(AdminGuard)
  async ingestBillingWebhook(
    @Args('provider') provider: string,
    @Args('eventType') eventType: string,
    @Args('externalEventId') externalEventId: string,
    @Args('payloadJson', { nullable: true }) payloadJson: string,
  ) {
    return this.billingService.ingestBillingWebhook({
      provider,
      eventType,
      externalEventId,
      payloadJson,
    });
  }
}
