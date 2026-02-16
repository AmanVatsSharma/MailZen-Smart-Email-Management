import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncRunItem {
  @Field()
  providerId: string;

  @Field()
  providerType: string;

  @Field()
  providerEmail: string;

  @Field()
  success: boolean;

  @Field({ nullable: true })
  error?: string | null;
}

@ObjectType()
export class ProviderSyncRunResponse {
  @Field(() => Int)
  requestedProviders: number;

  @Field(() => Int)
  syncedProviders: number;

  @Field(() => Int)
  failedProviders: number;

  @Field(() => Int)
  skippedProviders: number;

  @Field(() => [ProviderSyncRunItem])
  results: ProviderSyncRunItem[];

  @Field()
  executedAtIso: string;
}
