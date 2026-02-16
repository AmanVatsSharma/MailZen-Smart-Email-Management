import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxInboundSlaIncidentAlertConfigResponse {
  @Field()
  alertsEnabled: boolean;

  @Field(() => Float)
  targetSuccessPercent: number;

  @Field(() => Float)
  warningRejectedPercent: number;

  @Field(() => Float)
  criticalRejectedPercent: number;

  @Field(() => Int)
  cooldownMinutes: number;

  @Field(() => Int)
  incidentWindowHoursDefault: number;

  @Field(() => Int)
  incidentBucketMinutesDefault: number;

  @Field(() => Int)
  schedulerWindowHours: number;

  @Field(() => Int)
  schedulerCooldownMinutes: number;

  @Field(() => Int)
  schedulerMaxUsersPerRun: number;

  @Field()
  evaluatedAtIso: string;
}
