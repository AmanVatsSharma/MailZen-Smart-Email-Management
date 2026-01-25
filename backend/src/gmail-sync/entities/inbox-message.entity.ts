import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class InboxMessage {
  @Field(() => ID)
  id: string;

  @Field()
  providerId: string;

  @Field()
  externalMessageId: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field({ nullable: true })
  from?: string;

  @Field(() => [String])
  to: string[];

  @Field({ nullable: true })
  subject?: string;

  @Field({ nullable: true })
  snippet?: string;

  @Field({ nullable: true })
  internalDate?: string;

  @Field(() => [String])
  labels: string[];
}

