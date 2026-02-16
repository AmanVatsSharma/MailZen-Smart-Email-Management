import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentActionAuditRetentionPurgeResponse {
  @Field(() => Int)
  deletedRows: number;

  @Field(() => Int)
  retentionDays: number;

  @Field()
  userScoped: boolean;

  @Field()
  executedAtIso: string;
}
