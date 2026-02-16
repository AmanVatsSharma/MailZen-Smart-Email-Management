import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthIncidentStatsResponse {
  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  warnCount: number;

  @Field(() => Int)
  criticalCount: number;

  @Field({ nullable: true })
  lastIncidentAtIso?: string;
}

@ObjectType()
export class AgentPlatformHealthIncidentTrendPointResponse {
  @Field()
  bucketStartIso: string;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  warnCount: number;

  @Field(() => Int)
  criticalCount: number;
}
