import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateContactInput {
  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phone?: string;
} 