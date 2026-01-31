import { Field, ObjectType, ID } from '@nestjs/graphql';
import { GraphQLISODateTime } from '@nestjs/graphql';
import { User } from '../../user/entities/user.entity';

@ObjectType()
export class Email {
  @Field(() => ID)
  id: string;

  @Field()
  subject: string;

  @Field()
  body: string;

  @Field(() => User)
  sender: User;

  @Field(() => [User])
  recipients: User[];

  @Field()
  read: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
}