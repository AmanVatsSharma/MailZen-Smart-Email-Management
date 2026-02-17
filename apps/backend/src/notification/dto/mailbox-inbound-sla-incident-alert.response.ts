import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxInboundSlaIncidentAlertResponse {
  @Field()
  notificationId: string;

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field()
  slaStatus: string;

  @Field()
  title: string;

  @Field()
  message: string;

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

  @Field()
  createdAt: Date;
}
