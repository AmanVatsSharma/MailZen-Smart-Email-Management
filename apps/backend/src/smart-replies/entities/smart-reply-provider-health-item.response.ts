import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SmartReplyProviderHealthItemResponse {
  @Field()
  providerId: string;

  @Field()
  enabled: boolean;

  @Field()
  configured: boolean;

  @Field(() => Int)
  priority: number;

  @Field({ nullable: true })
  note?: string | null;
}
