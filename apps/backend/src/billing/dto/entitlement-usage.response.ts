import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EntitlementUsageResponse {
  @Field()
  planCode: string;

  @Field(() => Int)
  providerLimit: number;

  @Field(() => Int)
  providerUsed: number;

  @Field(() => Int)
  providerRemaining: number;

  @Field(() => Int)
  mailboxLimit: number;

  @Field(() => Int)
  mailboxUsed: number;

  @Field(() => Int)
  mailboxRemaining: number;

  @Field(() => Int)
  workspaceLimit: number;

  @Field(() => Int)
  workspaceUsed: number;

  @Field(() => Int)
  workspaceRemaining: number;

  @Field(() => Int)
  workspaceMemberLimit: number;

  @Field(() => Int)
  workspaceMemberUsed: number;

  @Field(() => Int)
  workspaceMemberRemaining: number;

  @Field({ nullable: true })
  workspaceMemberWorkspaceId?: string | null;

  @Field(() => Int)
  mailboxStorageLimitMb: number;

  @Field(() => Int)
  mailboxesOverEntitledStorageLimit: number;

  @Field(() => Int)
  aiCreditsPerMonth: number;

  @Field(() => Int)
  aiCreditsUsed: number;

  @Field(() => Int)
  aiCreditsRemaining: number;

  @Field()
  periodStart: string;

  @Field()
  evaluatedAtIso: string;
}
