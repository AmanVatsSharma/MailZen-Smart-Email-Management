import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProviderSyncAlertDeliveryStatsResponse {
  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalAlerts: number;

  @Field(() => Int)
  failedAlerts: number;

  @Field(() => Int)
  recoveredAlerts: number;

  @Field({ nullable: true })
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

  @Field({ nullable: true })
  workspaceId?: string | null;

  @Field()
  status: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field({ nullable: true })
  providerId?: string | null;

  @Field({ nullable: true })
  providerType?: string | null;

  @Field(() => Int, { nullable: true })
  attempts?: number | null;

  @Field({ nullable: true })
  error?: string | null;

  @Field()
  createdAt: Date;
}
