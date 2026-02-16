import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class InboxSourceHealthStatsResponse {
  @Field(() => Int)
  totalInboxes: number;

  @Field(() => Int)
  mailboxInboxes: number;

  @Field(() => Int)
  providerInboxes: number;

  @Field(() => Int)
  activeInboxes: number;

  @Field(() => Int)
  connectedInboxes: number;

  @Field(() => Int)
  syncingInboxes: number;

  @Field(() => Int)
  errorInboxes: number;

  @Field(() => Int)
  pendingInboxes: number;

  @Field(() => Int)
  disabledInboxes: number;

  @Field(() => Int)
  recentlySyncedInboxes: number;

  @Field(() => Int)
  recentlyErroredInboxes: number;

  @Field(() => Int)
  windowHours: number;

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field()
  executedAtIso: string;
}
