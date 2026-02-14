import { Field, ObjectType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class WarmupPerformanceMetrics {
  @Field(() => Float)
  averageOpenRate: number;

  @Field(() => Int)
  totalEmailsSent: number;

  @Field(() => Int)
  daysActive: number;

  @Field()
  currentPhase: string;
}

@ObjectType()
export class WarmupActivity {
  @Field()
  id: string;

  @Field()
  warmupId: string;

  @Field(() => Int)
  emailsSent: number;

  @Field(() => Float)
  openRate: number;

  @Field()
  date: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class EmailWarmup {
  @Field()
  id: string;

  @Field()
  providerId: string;

  @Field()
  status: string;

  @Field(() => Int)
  currentDailyLimit: number;

  @Field(() => Int)
  dailyIncrement: number;

  @Field(() => Int)
  maxDailyEmails: number;

  @Field(() => Int)
  minimumInterval: number;

  @Field(() => Int)
  targetOpenRate: number;

  @Field()
  startedAt: Date;

  @Field({ nullable: true })
  lastRunAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [WarmupActivity])
  activities: WarmupActivity[];
}
