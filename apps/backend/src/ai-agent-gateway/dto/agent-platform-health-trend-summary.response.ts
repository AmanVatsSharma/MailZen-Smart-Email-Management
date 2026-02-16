import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthTrendSummaryResponse {
  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  sampleCount: number;

  @Field(() => Int)
  healthyCount: number;

  @Field(() => Int)
  warnCount: number;

  @Field(() => Int)
  criticalCount: number;

  @Field(() => Float)
  avgErrorRatePercent: number;

  @Field(() => Float)
  peakErrorRatePercent: number;

  @Field(() => Float)
  avgLatencyMs: number;

  @Field(() => Float)
  peakLatencyMs: number;

  @Field({ nullable: true })
  latestCheckedAtIso?: string;
}
