import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncStatsResponse {
  @Field(() => Int)
  totalProviders: number;

  @Field(() => Int)
  connectedProviders: number;

  @Field(() => Int)
  syncingProviders: number;

  @Field(() => Int)
  errorProviders: number;

  @Field(() => Int)
  recentlySyncedProviders: number;

  @Field(() => Int)
  recentlyErroredProviders: number;

  @Field(() => Int)
  windowHours: number;

  @Field()
  executedAtIso: string;
}
