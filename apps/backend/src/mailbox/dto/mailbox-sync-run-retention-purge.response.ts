import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncRunRetentionPurgeResponse {
  @Field(() => Int)
  deletedRuns: number;

  @Field(() => Int)
  retentionDays: number;

  @Field()
  executedAtIso: string;
}
