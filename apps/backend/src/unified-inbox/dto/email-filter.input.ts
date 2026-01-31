import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class EmailFilterInput {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  folder?: string;

  @Field(() => [String], { nullable: true })
  labelIds?: string[];

  @Field({ nullable: true })
  status?: 'read' | 'unread';

  @Field({ nullable: true })
  isStarred?: boolean;

  @Field({ nullable: true })
  providerId?: string;
}

