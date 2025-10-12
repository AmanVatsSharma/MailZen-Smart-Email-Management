import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsArray, IsString, IsDate } from 'class-validator';

@InputType()
export class SendEmailInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  subject: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  body: string;

  @Field()
  @IsEmail()
  from: string;

  @Field(() => [String])
  @IsArray()
  @IsEmail({}, { each: true })
  to: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  providerId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  scheduledAt?: Date;
} 