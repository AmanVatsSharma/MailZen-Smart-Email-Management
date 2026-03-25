import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncAlertDeliveryStatsResponse {
  @Field(() => String, { nullable: true })
  workspaceId?: string | null;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalAlerts: number;

  @Field(() => Int)
  failedAlerts: number;

  @Field(() => Int)
  recoveredAlerts: number;

  @Field(() => String, { nullable: true })
  lastAlertAtIso?: string | null;
}

@ObjectType()
export class ProviderSyncAlertDeliveryTrendPointResponse {
  @Field()
  bucketStart: Date;

  @Field(() => Int)
  totalAlerts: number;

  @Field(() => Int)
  failedAlerts: number;

  @Field(() => Int)
  recoveredAlerts: number;
}

@ObjectType()
export class ProviderSyncAlertResponse {
  @Field()
  notificationId: string;

  @Field(() => String, { nullable: true })
  workspaceId?: string | null;

  @Field()
  status: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => String, { nullable: true })
  providerId?: string | null;

  @Field(() => String, { nullable: true })
  providerType?: string | null;

  @Field(() => Int, { nullable: true })
  attempts?: number | null;

  @Field(() => String, { nullable: true })
  error?: string | null;

  @Field()
  createdAt: Date;
}
