import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MailboxInboundSlaIncidentStatsResponse {
  @Field(() => String, { nullable: true })
  workspaceId?: string | null;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  warningCount: number;

  @Field(() => Int)
  criticalCount: number;

  @Field(() => Date, { nullable: true })
  lastAlertAt?: Date | null;
}

@ObjectType()
export class MailboxInboundSlaIncidentTrendPointResponse {
  @Field()
  bucketStart: Date;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  warningCount: number;

  @Field(() => Int)
  criticalCount: number;
}
