import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxSyncIncidentAlertDeliveryStatsResponse {
  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  warningCount: number;

  @Field(() => Int)
  criticalCount: number;

  @Field({ nullable: true })
  lastAlertAtIso?: string;
}

@ObjectType()
export class MailboxSyncIncidentAlertDeliveryTrendPointResponse {
  @Field()
  bucketStart: Date;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  warningCount: number;

  @Field(() => Int)
  criticalCount: number;
}
