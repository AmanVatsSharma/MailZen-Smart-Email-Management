import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PLAN_KEY = 'requirePlan';

/**
 * Declares that the decorated resolver method requires one of the specified
 * billing plan codes. Must be paired with RequirePlanGuard.
 *
 * @example
 * @UseGuards(JwtAuthGuard, RequirePlanGuard)
 * @RequirePlan('PRO', 'BUSINESS')
 * async startEmailWarmup(...) {}
 */
export const RequirePlan = (...planCodes: string[]) =>
  SetMetadata(REQUIRE_PLAN_KEY, planCodes);
