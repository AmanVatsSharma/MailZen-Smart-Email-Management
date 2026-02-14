import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

@InputType()
export class UpdateSmartReplySettingsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  defaultTone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  defaultLength?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  aiModel?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeSignature?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  personalization?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  creativityLevel?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxSuggestions?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  customInstructions?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  keepHistory?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  historyLength?: number;
}
