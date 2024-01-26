import { Field, InputType, ID } from '@nestjs/graphql';

@InputType()
export class UpdateUserInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  name?: string;
}
