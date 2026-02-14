import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('EmailTemplate')
export class EmailTemplate {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  subject: string;

  @Field()
  body: string;

  // NOTE: GraphQL doesn't support arbitrary object output without a JSON scalar.
  // For MVP we keep metadata in DB but do not expose it in GraphQL.
  metadata?: Record<string, any>;

  @Field()
  userId: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
