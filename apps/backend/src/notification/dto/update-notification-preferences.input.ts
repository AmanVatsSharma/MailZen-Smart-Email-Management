import { Field, InputType } from '@nestjs/graphql';

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
}
