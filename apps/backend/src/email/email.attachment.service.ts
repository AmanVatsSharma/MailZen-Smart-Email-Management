import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateAttachmentInput,
  DeleteAttachmentInput,
} from './dto/attachment.input';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import { Attachment } from './entities/attachment.entity';
import { Email } from './entities/email.entity';

@Injectable()
export class AttachmentService {
  private storage: Storage;
  private bucket: string;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    private readonly configService: ConfigService,
  ) {
    this.storage = new Storage({
      projectId: this.configService.get('GOOGLE_CLOUD_PROJECT_ID'),
      credentials: {
        client_email: this.configService.get('GOOGLE_CLOUD_CLIENT_EMAIL'),
        private_key: this.configService.get('GOOGLE_CLOUD_PRIVATE_KEY'),
      },
    });
    this.bucket =
      this.configService.get('GOOGLE_CLOUD_STORAGE_BUCKET') ||
      'mailzen-attachments';
  }

  async uploadAttachment(
    input: CreateAttachmentInput,
    userId: string,
  ): Promise<Attachment> {
    // Verify email ownership
    const email = await this.emailRepo.findOne({
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
    return this.attachmentRepo.save(
      this.attachmentRepo.create({
        filename: input.attachment.filename,
        contentType: input.attachment.contentType,
        size: input.attachment.size,
        url,
        emailId: input.emailId,
      }),
    );
  }

  async deleteAttachment(
    input: DeleteAttachmentInput,
    userId: string,
  ): Promise<boolean> {
    // Verify ownership
    const attachment = await this.attachmentRepo
      .createQueryBuilder('a')
      .innerJoin('a.email', 'e')
      .where('a.id = :id', { id: input.attachmentId })
      .andWhere('e.userId = :userId', { userId })
      .getOne();

    if (!attachment) {
      throw new NotFoundException(`Attachment not found`);
    }

    // Delete from Google Cloud Storage
    try {
      const u = new URL(attachment.url);
      // URL format: https://storage.googleapis.com/<bucket>/<objectPath>
      const parts = u.pathname.split('/').filter(Boolean);
      const objectPath = parts.length >= 2 ? parts.slice(1).join('/') : null;
      if (objectPath) {
        await this.storage.bucket(this.bucket).file(objectPath).delete();
      }
    } catch (e) {
      // Best-effort: DB delete still proceeds for MVP.
      console.warn(
        '[AttachmentService] Failed to delete from storage (continuing)',
        e,
      );
    }

    // Delete from database
    await this.attachmentRepo.delete({ id: input.attachmentId });

    return true;
  }

  async getAttachments(emailId: string, userId: string): Promise<Attachment[]> {
    const email = await this.emailRepo.findOne({
      where: { id: emailId, userId },
      relations: ['attachments'],
    });

    if (!email) {
      throw new NotFoundException(`Email with ID ${emailId} not found`);
    }

    return email.attachments || [];
  }
}
