import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertConfigResponse {
  @Field()
  alertsEnabled: boolean;

  @Field()
  scanAdminUsers: boolean;

  @Field(() => [String])
  configuredRecipientUserIds: string[];

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
  maxDeliverySampleScan: number;

  @Field()
  evaluatedAtIso: string;
}
