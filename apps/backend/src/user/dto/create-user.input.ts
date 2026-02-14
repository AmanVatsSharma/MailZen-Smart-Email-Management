import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field()
  @IsString()
  @MinLength(8)
  password: string;
}
