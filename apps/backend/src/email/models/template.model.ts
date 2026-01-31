import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Template {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  subject: string;

  @Field()
  body: string;

  @Field(() => Object, { nullable: true })
  metadata?: Record<string, any>;

  @Field()
  userId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
} 