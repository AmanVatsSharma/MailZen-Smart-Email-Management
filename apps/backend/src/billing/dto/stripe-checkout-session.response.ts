import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StripeCheckoutSessionResponse {
  @Field()
  sessionUrl: string;

  @Field()
  sessionId: string;

  @Field()
  planCode: string;
}
