import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncStateResponse {
  @Field()
  mailboxId: string;

  @Field()
  mailboxEmail: string;

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field({ nullable: true })
  inboundSyncCursor?: string | null;

  @Field({ nullable: true })
  inboundSyncStatus?: string | null;

  @Field({ nullable: true })
  inboundSyncLastPolledAt?: Date | null;

  @Field({ nullable: true })
  inboundSyncLastError?: string | null;

  @Field({ nullable: true })
  inboundSyncLastErrorAt?: Date | null;

  @Field({ nullable: true })
  inboundSyncLeaseExpiresAt?: Date | null;
}
