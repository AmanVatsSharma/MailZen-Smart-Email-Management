import { Field, ObjectType } from '@nestjs/graphql';
import { SmartReplyProviderHealthItemResponse } from './smart-reply-provider-health-item.response';

@ObjectType()
export class SmartReplyProviderHealthResponse {
  @Field()
  mode: string;

  @Field()
  hybridPrimary: string;

  @Field(() => [SmartReplyProviderHealthItemResponse])
  providers: SmartReplyProviderHealthItemResponse[];

  @Field()
  executedAtIso: string;
}
