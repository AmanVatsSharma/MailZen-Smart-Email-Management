import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RegisterNotificationPushSubscriptionInput {
  @Field()
  endpoint: string;

  @Field()
  p256dh: string;

  @Field()
  auth: string;

  @Field({ nullable: true })
  workspaceId?: string;

  @Field({ nullable: true })
  userAgent?: string;
}
