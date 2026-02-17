import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AiCreditBalanceResponse {
  @Field()
  planCode: string;

  @Field(() => Int)
  monthlyLimit: number;

  @Field(() => Int)
  usedCredits: number;

  @Field(() => Int)
  remainingCredits: number;

  @Field()
  periodStart: string;

  @Field({ nullable: true })
  lastConsumedAtIso?: string | null;
}
