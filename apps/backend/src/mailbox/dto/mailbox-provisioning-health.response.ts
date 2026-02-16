import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxProvisioningHealthResponse {
  @Field()
  provider: string;

  @Field()
  provisioningRequired: boolean;

  @Field()
  adminApiConfigured: boolean;

  @Field(() => Int)
  configuredEndpointCount: number;

  @Field(() => [String])
  configuredEndpoints: string[];

  @Field()
  failoverEnabled: boolean;

  @Field(() => Int)
  requestTimeoutMs: number;

  @Field(() => Int)
  maxRetries: number;

  @Field(() => Int)
  retryBackoffMs: number;

  @Field(() => Int)
  retryJitterMs: number;

  @Field(() => Int)
  mailcowQuotaDefaultMb: number;

  @Field()
  evaluatedAtIso: string;
}
