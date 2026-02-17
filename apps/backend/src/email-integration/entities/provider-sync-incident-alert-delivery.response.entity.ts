import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncIncidentAlertDeliveryStatsResponse {
  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalAlerts: number;

  @Field(() => Int)
  warningAlerts: number;

  @Field(() => Int)
  criticalAlerts: number;

  @Field({ nullable: true })
  lastAlertAtIso?: string | null;
}

@ObjectType()
export class ProviderSyncIncidentAlertDeliveryTrendPointResponse {
  @Field()
  bucketStart: Date;

  @Field(() => Int)
  totalAlerts: number;

  @Field(() => Int)
  warningAlerts: number;

  @Field(() => Int)
  criticalAlerts: number;
}

@ObjectType()
export class ProviderSyncIncidentAlertResponse {
  @Field()
  notificationId: string;

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field()
  status: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => Float)
  errorProviderPercent: number;

  @Field(() => Int)
  errorProviders: number;

  @Field(() => Int)
  totalProviders: number;

  @Field(() => Float)
  warningErrorProviderPercent: number;

  @Field(() => Float)
  criticalErrorProviderPercent: number;

  @Field(() => Int)
  minErrorProviders: number;

  @Field()
  createdAt: Date;
}
