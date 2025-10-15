import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SignupPhoneInput {
  @Field()
  phoneNumber: string;
}
