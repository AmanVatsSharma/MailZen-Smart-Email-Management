import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncIncidentStatsResponse {
  @Field({ nullable: true })
  mailboxId?: string | null;

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalRuns: number;

  @Field(() => Int)
  incidentRuns: number;

  @Field(() => Int)
  failedRuns: number;

  @Field(() => Int)
  partialRuns: number;

  @Field(() => Float)
  incidentRatePercent: number;

  @Field({ nullable: true })
  lastIncidentAtIso?: string;
}

@ObjectType()
export class MailboxSyncIncidentTrendPointResponse {
  @Field()
  bucketStart: Date;

  @Field(() => Int)
  totalRuns: number;

  @Field(() => Int)
  incidentRuns: number;

  @Field(() => Int)
  failedRuns: number;

  @Field(() => Int)
  partialRuns: number;
}
