import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SmartReplyHistoryPurgeResponse {
  @Field(() => Int)
  purgedRows: number;

  @Field()
  executedAtIso: string;
}
