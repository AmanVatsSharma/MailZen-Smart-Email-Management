import { Field, ObjectType, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class EmailAnalytics {
  @Field(() => ID)
  id: string;

  @Field()
  emailId: string;

  @Field(() => Int)
  openCount: number;

  @Field(() => Int)
  clickCount: number;

  @Field()
  lastUpdatedAt: Date;
} 