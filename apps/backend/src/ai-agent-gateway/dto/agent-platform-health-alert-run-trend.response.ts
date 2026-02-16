import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertRunTrendSummaryResponse {
  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  runCount: number;

  @Field(() => Int)
  alertsEnabledRunCount: number;

  @Field(() => Int)
  noAlertRunCount: number;

  @Field(() => Int)
  warningRunCount: number;

  @Field(() => Int)
  criticalRunCount: number;

  @Field(() => Int)
  totalRecipients: number;

  @Field(() => Int)
  totalPublished: number;

  @Field(() => Float)
  avgPublishedPerRun: number;

  @Field({ nullable: true })
  latestEvaluatedAtIso?: string;
}

@ObjectType()
export class AgentPlatformHealthAlertRunTrendPointResponse {
  @Field()
  bucketStartIso: string;

  @Field(() => Int)
  runCount: number;

  @Field(() => Int)
  noAlertRunCount: number;

  @Field(() => Int)
  warningRunCount: number;

  @Field(() => Int)
  criticalRunCount: number;

  @Field(() => Int)
  totalRecipients: number;

  @Field(() => Int)
  totalPublished: number;
}
