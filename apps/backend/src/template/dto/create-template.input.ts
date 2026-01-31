import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateTemplateInput {
  @Field()
  name: string;

  @Field()
  subject: string;

  @Field()
  body: string;
} 