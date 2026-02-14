import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EmailLabel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  color: string;

  @Field()
  count: number;
}
