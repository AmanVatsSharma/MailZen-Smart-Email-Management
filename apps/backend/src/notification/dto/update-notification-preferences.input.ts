import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateNotificationPreferencesInput {
  @Field({ nullable: true })
  inAppEnabled?: boolean;

  @Field({ nullable: true })
  emailEnabled?: boolean;

  @Field({ nullable: true })
  pushEnabled?: boolean;

  @Field({ nullable: true })
  syncFailureEnabled?: boolean;

  @Field({ nullable: true })
  mailboxInboundAcceptedEnabled?: boolean;

  @Field({ nullable: true })
  mailboxInboundDeduplicatedEnabled?: boolean;

  @Field({ nullable: true })
  mailboxInboundRejectedEnabled?: boolean;

  @Field(() => Float, { nullable: true })
  mailboxInboundSlaTargetSuccessPercent?: number;

  @Field(() => Float, { nullable: true })
  mailboxInboundSlaWarningRejectedPercent?: number;

  @Field(() => Float, { nullable: true })
  mailboxInboundSlaCriticalRejectedPercent?: number;

  @Field({ nullable: true })
  mailboxInboundSlaAlertsEnabled?: boolean;

  @Field(() => Int, { nullable: true })
  mailboxInboundSlaAlertCooldownMinutes?: number;
}
