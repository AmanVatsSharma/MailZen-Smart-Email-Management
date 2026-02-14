import { Field, ObjectType, ID } from '@nestjs/graphql';

@ObjectType()
export class Feature {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  isActive: boolean;
}
