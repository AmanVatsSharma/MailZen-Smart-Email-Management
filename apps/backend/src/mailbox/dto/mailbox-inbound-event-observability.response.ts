import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxInboundEventObservabilityResponse {
  @Field()
  id: string;

  @Field()
  mailboxId: string;

  @Field({ nullable: true })
  mailboxEmail?: string | null;

  @Field({ nullable: true })
  messageId?: string | null;

  @Field({ nullable: true })
  emailId?: string | null;

  @Field({ nullable: true })
  inboundThreadKey?: string | null;

  @Field()
  status: string;

  @Field({ nullable: true })
  sourceIp?: string | null;

  @Field()
  signatureValidated: boolean;

  @Field({ nullable: true })
  errorReason?: string | null;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class MailboxInboundEventStatsResponse {
  @Field({ nullable: true })
  mailboxId?: string | null;

  @Field({ nullable: true })
  mailboxEmail?: string | null;

  @Field(() => Int)
  windowHours: number;

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

  @Field()
  slaStatus: string;

  @Field()
  meetsSla: boolean;

  @Field({ nullable: true })
  lastProcessedAt?: Date | null;
}

@ObjectType()
export class MailboxInboundEventTrendPointResponse {
  @Field()
  bucketStart: Date;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  acceptedCount: number;

  @Field(() => Int)
  deduplicatedCount: number;

  @Field(() => Int)
  rejectedCount: number;
}
