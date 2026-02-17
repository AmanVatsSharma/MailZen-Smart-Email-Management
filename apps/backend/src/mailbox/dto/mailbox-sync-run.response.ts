import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncRunResponse {
  @Field(() => Int)
  polledMailboxes: number;

  @Field(() => Int)
  skippedMailboxes: number;

  @Field(() => Int)
  failedMailboxes: number;

  @Field(() => Int)
  fetchedMessages: number;

  @Field(() => Int)
  acceptedMessages: number;

  @Field(() => Int)
  deduplicatedMessages: number;

  @Field(() => Int)
  rejectedMessages: number;

  @Field()
  executedAtIso: string;
}
