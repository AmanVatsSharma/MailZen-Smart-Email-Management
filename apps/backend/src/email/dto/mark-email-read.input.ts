import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class MarkEmailReadInput {
  @Field()
  emailId: string;
}
