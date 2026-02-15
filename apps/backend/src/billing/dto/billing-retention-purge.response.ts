import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BillingRetentionPurgeResponse {
  @Field(() => Int)
  webhookEventsDeleted: number;

  @Field(() => Int)
  aiUsageRowsDeleted: number;

  @Field(() => Int)
  webhookRetentionDays: number;

  @Field(() => Int)
  aiUsageRetentionMonths: number;

  @Field()
  executedAtIso: string;
}
