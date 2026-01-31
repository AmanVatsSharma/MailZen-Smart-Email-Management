import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EmailAttachment {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  type: string;

  @Field()
  size: number;

  @Field({ nullable: true })
  url?: string;
}

