import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EmailFolder {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  count: number;

  @Field()
  unreadCount: number;
}
