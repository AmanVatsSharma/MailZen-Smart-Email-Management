import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class MailboxInboundWebhookInput {
  @IsEmail()
  mailboxEmail: string;

  @IsEmail()
  from: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsEmail({}, { each: true })
  to?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(998)
  subject?: string;

  @IsOptional()
  @IsString()
  textBody?: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  inReplyTo?: string;

  @IsOptional()
  @IsString()
  sizeBytes?: string;
}
