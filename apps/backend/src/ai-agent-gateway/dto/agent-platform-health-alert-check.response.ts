import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AgentPlatformHealthAlertCheckResponse {
  @Field()
  alertsEnabled: boolean;

  @Field()
  evaluatedAtIso: string;

  @Field(() => Int)
  windowHours: number;

  @Field(() => Int)
  baselineWindowHours: number;

  @Field(() => Int)
  cooldownMinutes: number;

  @Field(() => Int)
  minSampleCount: number;

  @Field({ nullable: true })
  severity?: string | null;

  @Field(() => [String])
  reasons: string[];

  @Field(() => Int)
  recipientCount: number;

  @Field(() => Int)
  publishedCount: number;
}
