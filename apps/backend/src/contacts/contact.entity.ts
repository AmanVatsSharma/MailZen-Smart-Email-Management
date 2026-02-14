import { Field, ObjectType, ID } from '@nestjs/graphql';

@ObjectType()
export class Contact {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  // Explicit type required (union `string | null` can break GraphQL reflection).
  @Field(() => String, { nullable: true })
  phone?: string;

  @Field()
  userId: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
