import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

@InputType()
export class VerifySignupInput {
  @Field()
  @IsString()
  phoneNumber: string;

  @Field()
  @IsString()
  code: string;

  @Field()
  @IsEmail()
  email: string; // initial login email (= chosen mailzen email)

  @Field()
  @IsString()
  @MinLength(8)
  password: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:[a-z0-9.]{1,28}[a-z0-9])?$/)
  desiredLocalPart?: string; // mailzen handle
}
