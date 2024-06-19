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