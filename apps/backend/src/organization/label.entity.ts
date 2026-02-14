import { Field, ObjectType, ID } from '@nestjs/graphql';

@ObjectType()
export class Label {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  color?: string; // Optional: to style the label
}
