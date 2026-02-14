import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';

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

  // NOTE: GraphQL doesn't support arbitrary object inputs without a JSON scalar.
  // For MVP we keep metadata off the schema.
  @IsOptional()
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

  // NOTE: GraphQL doesn't support arbitrary object inputs without a JSON scalar.
  // For MVP we keep metadata off the schema.
  @IsOptional()
  metadata?: Record<string, any>;
}
