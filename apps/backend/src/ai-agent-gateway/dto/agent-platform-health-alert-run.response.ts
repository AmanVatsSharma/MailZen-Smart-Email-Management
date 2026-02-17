import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertRunResponse {
  @Field()
  alertsEnabled: boolean;

  @Field({ nullable: true })
  severity?: string | null;

  @Field(() => [String])
  reasons: string[];

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  baselineWindowHours: number;

  @Field(() => Int)
  cooldownMinutes: number;

  @Field(() => Int)
  minSampleCount: number;

  @Field(() => Float)
  anomalyMultiplier: number;

  @Field(() => Float)
  anomalyMinErrorDeltaPercent: number;

  @Field(() => Float)
  anomalyMinLatencyDeltaMs: number;

  @Field(() => Float)
  errorRateWarnPercent: number;

  @Field(() => Float)
  latencyWarnMs: number;

  @Field(() => Int)
  recipientCount: number;

  @Field(() => Int)
  publishedCount: number;

  @Field()
  evaluatedAtIso: string;
}
