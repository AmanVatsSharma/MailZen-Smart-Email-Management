import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

@InputType()
export class SmtpSettingsInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  host: string;

  @Field(() => Int)
  @IsNumber()
  port: number;

  @Field()
  @IsNotEmpty()
  @IsString()
  username: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  password: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  secure?: boolean;
}
