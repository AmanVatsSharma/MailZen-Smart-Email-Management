import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateLabelInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  color?: string;
} 