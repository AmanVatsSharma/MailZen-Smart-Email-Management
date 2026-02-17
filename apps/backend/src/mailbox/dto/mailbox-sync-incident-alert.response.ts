import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncIncidentAlertResponse {
  @Field()
  notificationId: string;

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field()
  status: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => Float)
  incidentRatePercent: number;

  @Field(() => Int)
  incidentRuns: number;

  @Field(() => Int)
  totalRuns: number;

  @Field(() => Float)
  warningRatePercent: number;

  @Field(() => Float)
  criticalRatePercent: number;

  @Field()
  createdAt: Date;
}
