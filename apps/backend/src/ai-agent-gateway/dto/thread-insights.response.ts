import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ThreadClassificationResponse {
  @Field()
  label: string;

  @Field(() => Float)
  confidence: number;

  @Field()
  message: string;
}

@ObjectType()
export class ThreadPriorityResponse {
  @Field()
  level: string;

  @Field(() => Int)
  score: number;

  @Field()
  message: string;
}

@ObjectType()
export class ThreadInsightsResponse {
  @Field({ nullable: true })
  summary?: string;

  @Field(() => ThreadClassificationResponse, { nullable: true })
  classification?: ThreadClassificationResponse;

  @Field(() => ThreadPriorityResponse, { nullable: true })
  priority?: ThreadPriorityResponse;

  @Field(() => [String])
  actionItems: string[];

  @Field()
  generatedAt: string;

  @Field()
  threadId: string;
}
