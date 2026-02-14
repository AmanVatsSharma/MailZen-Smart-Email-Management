import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class Attachment {
  @Field()
  id: string;

  @Field()
  filename: string;

  @Field()
  contentType: string;

  @Field(() => Int, { nullable: true })
  size?: number;

  @Field()
  url: string;

  @Field()
  emailId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
