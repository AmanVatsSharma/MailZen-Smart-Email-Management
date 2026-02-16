import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxInboundSlaAlertCheckResponse {
  @Field()
  alertsEnabled: boolean;

  @Field()
  evaluatedAtIso: string;

  @Field(() => Int)
  windowHours: number;

  @Field()
  status: string;

  @Field()
  statusReason: string;

  @Field()
  shouldAlert: boolean;

  @Field(() => Int)
  cooldownMinutes: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  acceptedCount: number;

  @Field(() => Int)
  deduplicatedCount: number;

  @Field(() => Int)
  rejectedCount: number;

  @Field(() => Float)
  successRatePercent: number;

  @Field(() => Float)
  rejectionRatePercent: number;

  @Field(() => Float)
  slaTargetSuccessPercent: number;

  @Field(() => Float)
  slaWarningRejectedPercent: number;

  @Field(() => Float)
  slaCriticalRejectedPercent: number;

  @Field({ nullable: true })
  lastProcessedAtIso?: string;
}
