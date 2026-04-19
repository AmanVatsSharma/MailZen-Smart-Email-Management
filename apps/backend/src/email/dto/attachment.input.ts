/**
 * File:        apps/backend/src/email/dto/attachment.input.ts
 * Module:      Email · DTOs
 * Purpose:     GraphQL InputTypes for attachment CRUD operations and inline
 *              attachment payloads embedded in SendEmailInput.
 *
 * Exports:
 *   - AttachmentInput         — per-attachment payload (filename, contentType, base64 content, size)
 *   - CreateAttachmentInput   — wraps AttachmentInput with the target emailId for the upload mutation
 *   - DeleteAttachmentInput   — identifies an attachment to delete by emailId + attachmentId
 *
 * Depends on:
 *   - none (GraphQL/class-validator decorators only)
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - content must be raw base64 (no data-URL prefix)
 *   - size is optional (nullable) — stored if provided, otherwise null
 *
 * Read order:
 *   1. AttachmentInput        — base payload shape
 *   2. CreateAttachmentInput  — mutation input that references an existing email
 *   3. DeleteAttachmentInput  — mutation input for deletion
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional, IsNumber } from 'class-validator';

@InputType()
export class AttachmentInput {
  @Field()
  @IsString()
  filename: string;

  @Field()
  @IsString()
  contentType: string;

  @Field()
  @IsString()
  content: string; // Base64 encoded content

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  size?: number;
}

@InputType()
export class CreateAttachmentInput {
  @Field()
  @IsString()
  emailId: string;

  @Field(() => AttachmentInput)
  attachment: AttachmentInput;
}

@InputType()
export class DeleteAttachmentInput {
  @Field()
  @IsString()
  emailId: string;

  @Field()
  @IsString()
  attachmentId: string;
}
