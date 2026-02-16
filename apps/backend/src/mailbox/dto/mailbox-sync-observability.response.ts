import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncRunObservabilityResponse {
  @Field()
  id: string;

  @Field()
  mailboxId: string;

  @Field({ nullable: true })
  mailboxEmail?: string | null;

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field()
  triggerSource: string;

  @Field()
  runCorrelationId: string;

  @Field()
  status: string;

  @Field(() => Int)
  fetchedMessages: number;

  @Field(() => Int)
  acceptedMessages: number;

  @Field(() => Int)
  deduplicatedMessages: number;

  @Field(() => Int)
  rejectedMessages: number;

  @Field({ nullable: true })
  nextCursor?: string | null;

  @Field({ nullable: true })
  errorMessage?: string | null;

  @Field()
  startedAt: Date;

  @Field()
  completedAt: Date;

  @Field(() => Int)
  durationMs: number;
}

@ObjectType()
export class MailboxSyncRunStatsResponse {
  @Field({ nullable: true })
  mailboxId?: string | null;

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalRuns: number;

  @Field(() => Int)
  successRuns: number;

  @Field(() => Int)
  partialRuns: number;

  @Field(() => Int)
  failedRuns: number;

  @Field(() => Int)
  skippedRuns: number;

  @Field(() => Int)
  schedulerRuns: number;

  @Field(() => Int)
  manualRuns: number;

  @Field(() => Int)
  fetchedMessages: number;

  @Field(() => Int)
  acceptedMessages: number;

  @Field(() => Int)
  deduplicatedMessages: number;

  @Field(() => Int)
  rejectedMessages: number;

  @Field(() => Float)
  avgDurationMs: number;

  @Field({ nullable: true })
  latestCompletedAtIso?: string;
}

@ObjectType()
export class MailboxSyncRunTrendPointResponse {
  @Field()
  bucketStart: Date;

  @Field(() => Int)
  totalRuns: number;

  @Field(() => Int)
  successRuns: number;

  @Field(() => Int)
  partialRuns: number;

  @Field(() => Int)
  failedRuns: number;

  @Field(() => Int)
  skippedRuns: number;

  @Field(() => Int)
  fetchedMessages: number;

  @Field(() => Int)
  acceptedMessages: number;

  @Field(() => Int)
  deduplicatedMessages: number;

  @Field(() => Int)
  rejectedMessages: number;
}
