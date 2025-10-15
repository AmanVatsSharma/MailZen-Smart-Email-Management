import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class VerifySignupInput {
  @Field()
  phoneNumber: string;

  @Field()
  code: string;

  @Field()
  email: string; // initial login email (= chosen mailzen email)

  @Field()
  password: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  desiredLocalPart?: string; // mailzen handle
}
