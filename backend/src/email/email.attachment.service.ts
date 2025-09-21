import { Injectable, NotFoundException } from '@nestjs/common';
// Prisma removed
import { CreateAttachmentInput, DeleteAttachmentInput } from './dto/attachment.input';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import { Attachment } from '@prisma/client';

@Injectable()
export class AttachmentService {
  private storage: Storage;
  private bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.storage = new Storage({
      projectId: this.configService.get('GOOGLE_CLOUD_PROJECT_ID'),
      credentials: {
        client_email: this.configService.get('GOOGLE_CLOUD_CLIENT_EMAIL'),
        private_key: this.configService.get('GOOGLE_CLOUD_PRIVATE_KEY'),
      },
    });
    this.bucket = this.configService.get('GOOGLE_CLOUD_STORAGE_BUCKET') || 'mailzen-attachments';
  }

  async uploadAttachment(input: CreateAttachmentInput, userId: string): Promise<Attachment> {
    // Verify email ownership
    const email = await this.prisma.email.findFirst({
      where: { id: input.emailId, userId },
    });

    if (!email) {
      throw new NotFoundException(`Email with ID ${input.emailId} not found`);
    }

    // Upload to Google Cloud Storage
    const buffer = Buffer.from(input.attachment.content, 'base64');
    const filename = `${userId}/${input.emailId}/${input.attachment.filename}`;
    const file = this.storage.bucket(this.bucket).file(filename);

    await file.save(buffer, {
      metadata: {
        contentType: input.attachment.contentType,
      },
    });

    // Make the file public and get URL
    await file.makePublic();
    const url = `https://storage.googleapis.com/${this.bucket}/${filename}`;

    // Create attachment record
    return this.prisma.attachment.create({
      data: {
        filename: input.attachment.filename,
        contentType: input.attachment.contentType,
        size: input.attachment.size,
        url,
        emailId: input.emailId,
      },
    });
  }

  async deleteAttachment(input: DeleteAttachmentInput, userId: string): Promise<boolean> {
    // Verify ownership
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: input.attachmentId,
        email: {
          userId,
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment not found`);
    }

    // Delete from Google Cloud Storage
    const filename = attachment.url.split('/').pop();
    if (filename) {
      await this.storage.bucket(this.bucket).file(filename).delete();
    }

    // Delete from database
    await this.prisma.attachment.delete({
      where: { id: input.attachmentId },
    });

    return true;
  }

  async getAttachments(emailId: string, userId: string): Promise<Attachment[]> {
    const email = await this.prisma.email.findFirst({
      where: { id: emailId, userId },
      include: { attachments: true },
    });

    if (!email) {
      throw new NotFoundException(`Email with ID ${emailId} not found`);
    }

    return email.attachments;
  }
} 