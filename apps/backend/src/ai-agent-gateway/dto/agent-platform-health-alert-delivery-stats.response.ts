import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertDeliveryStatsResponse {
  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  warningCount: number;

  @Field(() => Int)
  criticalCount: number;

  @Field(() => Int)
  uniqueRecipients: number;

  @Field({ nullable: true })
  lastAlertAtIso?: string;
}

@ObjectType()
export class AgentPlatformHealthAlertDeliveryTrendPointResponse {
  @Field()
  bucketStartIso: string;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  warningCount: number;

  @Field(() => Int)
  criticalCount: number;

  @Field(() => Int)
  uniqueRecipients: number;
}
