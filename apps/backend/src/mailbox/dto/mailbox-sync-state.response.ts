import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncStateResponse {
  @Field()
  mailboxId: string;

  @Field()
  mailboxEmail: string;

  @Field(() => String, { nullable: true })
  workspaceId?: string | null;

  @Field(() => String, { nullable: true })
  inboundSyncCursor?: string | null;

  @Field(() => String, { nullable: true })
  inboundSyncStatus?: string | null;

  @Field(() => Date, { nullable: true })
  inboundSyncLastPolledAt?: Date | null;

  @Field(() => String, { nullable: true })
  inboundSyncLastError?: string | null;

  @Field(() => Date, { nullable: true })
  inboundSyncLastErrorAt?: Date | null;

  @Field(() => Date, { nullable: true })
  inboundSyncLeaseExpiresAt?: Date | null;
}
