import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncIncidentAlertCheckResponse {
  @Field()
  alertsEnabled: boolean;

  @Field()
  evaluatedAtIso: string;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Float)
  warningErrorProviderPercent: number;

  @Field(() => Float)
  criticalErrorProviderPercent: number;

  @Field(() => Int)
  minErrorProviders: number;

  @Field()
  status: string;

  @Field()
  statusReason: string;

  @Field()
  shouldAlert: boolean;

  @Field(() => Int)
  totalProviders: number;

  @Field(() => Int)
  connectedProviders: number;

  @Field(() => Int)
  syncingProviders: number;

  @Field(() => Int)
  errorProviders: number;

  @Field(() => Float)
  errorProviderPercent: number;
}
