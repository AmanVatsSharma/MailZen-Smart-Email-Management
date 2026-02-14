import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  ValidateIf,
} from 'class-validator';

@InputType()
export class EmailProviderInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @IsIn(['GMAIL', 'OUTLOOK', 'CUSTOM_SMTP'])
  providerType: string;

  @Field()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @ValidateIf((o) => o.providerType === 'CUSTOM_SMTP')
  @IsNotEmpty({ message: 'Password is required for SMTP providers' })
  @IsString()
  @IsOptional()
  password?: string;

  @Field({ nullable: true })
  @ValidateIf((o) => o.providerType === 'CUSTOM_SMTP')
  @IsNotEmpty({ message: 'Host is required for SMTP providers' })
  @IsString()
  @IsOptional()
  host?: string;

  @Field(() => Int, { nullable: true })
  @ValidateIf((o) => o.providerType === 'CUSTOM_SMTP')
  @IsNotEmpty({ message: 'Port is required for SMTP providers' })
  @IsNumber()
  @IsOptional()
  port?: number;

  @Field({ nullable: true })
  @ValidateIf((o) => ['GMAIL', 'OUTLOOK'].includes(o.providerType))
  @IsNotEmpty({ message: 'Access token is required for OAuth providers' })
  @IsString()
  @IsOptional()
  accessToken?: string;

  @Field({ nullable: true })
  @ValidateIf((o) => ['GMAIL', 'OUTLOOK'].includes(o.providerType))
  @IsString()
  @IsOptional()
  refreshToken?: string;

  @Field({ nullable: true })
  @ValidateIf((o) => ['GMAIL', 'OUTLOOK'].includes(o.providerType))
  @IsNumber()
  @IsOptional()
  tokenExpiry?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  autoDetect?: boolean;
}
