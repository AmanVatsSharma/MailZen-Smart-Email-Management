import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertRunRetentionPurgeResponse {
  @Field(() => Int)
  deletedRuns: number;

  @Field(() => Int)
  retentionDays: number;

  @Field()
  executedAtIso: string;
}
