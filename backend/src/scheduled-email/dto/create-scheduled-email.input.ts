import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateScheduledEmailInput {
  @Field()
  subject: string;

  @Field()
  body: string;

  @Field(() => [String])
  recipientIds: string[];

  @Field()
  scheduledAt: Date;

  @Field({ defaultValue: 'PENDING' })
  status: string;
} 