import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxInboundRetentionPurgeResponse {
  @Field(() => Int)
  deletedEvents: number;

  @Field(() => Int)
  retentionDays: number;

  @Field()
  executedAtIso: string;
}
