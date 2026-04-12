import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RazorpayCheckoutResponse {
  @Field()
  checkoutUrl: string;

  @Field()
  subscriptionId: string;

  @Field()
  planCode: string;

  @Field()
  keyId: string;
}
