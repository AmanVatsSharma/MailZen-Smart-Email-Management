import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncIncidentAlertCheckResponse {
  @Field()
  alertsEnabled: boolean;

  @Field()
  evaluatedAtIso: string;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Float)
  warningRatePercent: number;

  @Field(() => Float)
  criticalRatePercent: number;

  @Field(() => Int)
  minIncidentRuns: number;

  @Field()
  status: string;

  @Field()
  statusReason: string;

  @Field()
  shouldAlert: boolean;

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
