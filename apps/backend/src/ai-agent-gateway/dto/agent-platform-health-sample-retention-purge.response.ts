import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthSampleRetentionPurgeResponse {
  @Field(() => Int)
  deletedSamples: number;

  @Field(() => Int)
  retentionDays: number;

  @Field()
  executedAtIso: string;
}
