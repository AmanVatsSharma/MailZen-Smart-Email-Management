import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { BillingUpgradeIntentResponse } from './dto/billing-upgrade-intent.response';
import { BillingPlan } from './entities/billing-plan.entity';
import { UserSubscription } from './entities/user-subscription.entity';

interface RequestContext {
  req: {
    user: {
      id: string;
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
}
