import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { REQUIRE_PLAN_KEY } from '../../common/decorators/require-plan.decorator';
import { BillingService } from '../billing.service';

/**
 * Resolver-level plan enforcement guard.
 *
 * When a resolver method is decorated with @RequirePlan('PRO', 'BUSINESS'),
 * this guard verifies that the authenticated user's active plan code is
 * contained in the allowed set before the resolver executes.
 *
 * Must be used after JwtAuthGuard so req.user is already populated.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RequirePlanGuard)
 *   @RequirePlan('PRO', 'BUSINESS')
 *   async myResolver(...) {}
 */
@Injectable()
export class RequirePlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlans = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlans || requiredPlans.length === 0) {
      return true;
    }

    const contextType = context.getType<'http' | 'graphql' | string>();
    const request =
      contextType === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();

    const userId: string | undefined = request?.user?.id;
    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const entitlements = await this.billingService.getEntitlements(userId);
    const normalizedPlan = entitlements.planCode.toUpperCase();
    const normalizedRequired = requiredPlans.map((p) => p.toUpperCase());

    if (!normalizedRequired.includes(normalizedPlan)) {
      throw new ForbiddenException(
        `This feature requires one of the following plans: ${normalizedRequired.join(', ')}. Your current plan is ${normalizedPlan}.`,
      );
    }

    return true;
  }
}
