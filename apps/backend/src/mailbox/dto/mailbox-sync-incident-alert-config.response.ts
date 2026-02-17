import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncIncidentAlertConfigResponse {
  @Field()
  alertsEnabled: boolean;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  cooldownMinutes: number;

  @Field(() => Int)
  maxUsersPerRun: number;

  @Field(() => Float)
  warningRatePercent: number;

  @Field(() => Float)
  criticalRatePercent: number;

  @Field(() => Int)
  minIncidentRuns: number;

  @Field()
  evaluatedAtIso: string;
}
