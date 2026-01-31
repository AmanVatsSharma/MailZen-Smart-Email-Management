import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class VerifyEmailInput {
  @Field()
  token: string;
}
