import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NotificationRetentionPurgeResponse {
  @Field(() => Int)
  notificationsDeleted: number;

  @Field(() => Int)
  pushSubscriptionsDeleted: number;

  @Field(() => Int)
  notificationRetentionDays: number;

  @Field(() => Int)
  disabledPushRetentionDays: number;

  @Field()
  executedAtIso: string;
}
