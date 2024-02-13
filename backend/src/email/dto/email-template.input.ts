import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional, IsObject } from 'class-validator';

@InputType()
export class CreateEmailTemplateInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  subject: string;

  @Field()
  @IsString()
  body: string;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

@InputType()
export class UpdateEmailTemplateInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  subject?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  body?: string;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
} 