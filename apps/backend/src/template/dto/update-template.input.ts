import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class UpdateTemplateInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  subject?: string;

  @Field({ nullable: true })
  body?: string;
}
