import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EmailParticipant {
  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  avatar?: string;
}
