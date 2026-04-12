import { Field, Int, ObjectType } from '@nestjs/graphql';
import { EmailThread } from './email-thread.entity';

@ObjectType()
export class PaginatedEmailThreads {
  @Field(() => [EmailThread])
  items: EmailThread[];

  @Field(() => Int)
  totalCount: number;
}
