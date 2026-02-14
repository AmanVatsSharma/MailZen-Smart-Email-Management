import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateEmailInput {
  @Field()
  senderId: string;

  @Field()
  subject: string;

  @Field()
  body: string;

  @Field(() => [String])
  recipientIds: string[];
}
