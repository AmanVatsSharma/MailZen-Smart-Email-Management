/**
 * File:        apps/backend/src/email/dto/send-email.input.ts
 * Module:      Email · DTOs
 * Purpose:     GraphQL InputType for the sendEmail mutation, including optional
 *              inline base64-encoded attachments that are uploaded during send.
 *
 * Exports:
 *   - SendEmailInput   — input shape for the sendEmail GraphQL mutation
 *
 * Depends on:
 *   - ./attachment.input  — re-uses AttachmentInput for inline attachment payloads
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - attachments content field must be raw base64 (no data-URL prefix)
 *   - scheduledAt is optional; if provided the email is queued, not sent immediately
 *
 * Read order:
 *   1. AttachmentInput  — per-attachment payload shape (defined in attachment.input.ts)
 *   2. SendEmailInput   — top-level mutation input
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsDate,
} from 'class-validator';
import { AttachmentInput } from './attachment.input';

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

  @Field(() => [AttachmentInput], { nullable: true })
  @IsOptional()
  @IsArray()
  attachments?: AttachmentInput[];
}
