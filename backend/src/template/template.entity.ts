import { Field, ObjectType, ID } from '@nestjs/graphql';

@ObjectType()
export class Template {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  subject: string;

  @Field()
  body: string;
} 