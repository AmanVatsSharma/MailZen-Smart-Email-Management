import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BillingUpgradeIntentResponse {
  @Field()
  success: boolean;

  @Field()
  targetPlanCode: string;

  @Field()
  message: string;
}
