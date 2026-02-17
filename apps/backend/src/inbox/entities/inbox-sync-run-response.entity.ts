import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class InboxSyncRunResponse {
  @Field(() => Int)
  mailboxPolledMailboxes: number;

  @Field(() => Int)
  mailboxSkippedMailboxes: number;

  @Field(() => Int)
  mailboxFailedMailboxes: number;

  @Field(() => Int)
  providerRequestedProviders: number;

  @Field(() => Int)
  providerSyncedProviders: number;

  @Field(() => Int)
  providerFailedProviders: number;

  @Field(() => Int)
  providerSkippedProviders: number;

  @Field()
  success: boolean;

  @Field({ nullable: true })
  mailboxSyncError?: string | null;

  @Field({ nullable: true })
  providerSyncError?: string | null;

  @Field()
  executedAtIso: string;
}
