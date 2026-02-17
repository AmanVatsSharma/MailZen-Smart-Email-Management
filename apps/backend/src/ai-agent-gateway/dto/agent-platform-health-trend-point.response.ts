import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthTrendPointResponse {
  @Field()
  bucketStartIso: string;

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
  avgLatencyMs: number;
}
