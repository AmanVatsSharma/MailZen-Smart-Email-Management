import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateEmailAnalyticsInput {
  @Field()
  emailId: string;

  @Field(() => Int, { defaultValue: 0 })
  openCount: number;

  @Field(() => Int, { defaultValue: 0 })
  clickCount: number;

  @Field()
  lastUpdatedAt: Date;
} 