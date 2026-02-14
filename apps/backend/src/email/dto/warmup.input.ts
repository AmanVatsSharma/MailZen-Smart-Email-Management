import { Field, InputType, Int } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

@InputType()
export class WarmupConfigInput {
  @Field(() => Int)
  @IsNumber()
  @Min(1)
  @Max(100)
  dailyIncrement: number = 5; // Default increment of 5 emails per day

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  @Max(1000)
  maxDailyEmails: number = 100; // Maximum emails per day

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  minimumInterval: number = 15; // Minimum minutes between emails

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(100)
  targetOpenRate: number = 80; // Target open rate percentage
}

@InputType()
export class StartWarmupInput {
  @Field()
  @IsString()
  providerId: string;

  @Field(() => WarmupConfigInput, { nullable: true })
  @IsOptional()
  config?: WarmupConfigInput;
}

@InputType()
export class PauseWarmupInput {
  @Field()
  @IsString()
  providerId: string;
}
