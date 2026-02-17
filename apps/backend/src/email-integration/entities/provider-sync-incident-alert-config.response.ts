import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncIncidentAlertConfigResponse {
  @Field()
  alertsEnabled: boolean;

  @Field()
  syncFailureEnabled: boolean;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  cooldownMinutes: number;

  @Field(() => Int)
  maxUsersPerRun: number;

  @Field(() => Float)
  warningErrorProviderPercent: number;

  @Field(() => Float)
  criticalErrorProviderPercent: number;

  @Field(() => Int)
  minErrorProviders: number;

  @Field()
  evaluatedAtIso: string;
}
