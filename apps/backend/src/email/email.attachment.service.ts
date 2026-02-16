import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import {
  CreateAttachmentInput,
  DeleteAttachmentInput,
} from './dto/attachment.input';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import { Attachment } from './entities/attachment.entity';
import { Email } from './entities/email.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private storage: Storage;
  private bucket: string;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
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

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepo.create({
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
      });
      await this.auditLogRepo.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'attachment_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
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
    const savedAttachment = await this.attachmentRepo.save(
      this.attachmentRepo.create({
        filename: input.attachment.filename,
        contentType: input.attachment.contentType,
        size: input.attachment.size,
        url,
        emailId: input.emailId,
      }),
    );
    await this.writeAuditLog({
      userId,
      action: 'attachment_uploaded',
      metadata: {
        attachmentId: savedAttachment.id,
        emailId: savedAttachment.emailId,
        filename: savedAttachment.filename,
        contentType: savedAttachment.contentType,
        size: savedAttachment.size ?? null,
      },
    });
    return savedAttachment;
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
      this.logger.warn(
        serializeStructuredLog({
          event: 'attachment_storage_delete_failed',
          attachmentId: input.attachmentId,
          userId,
          error:
            e instanceof Error ? e.message : 'unknown storage delete error',
        }),
      );
    }

    // Delete from database
    await this.attachmentRepo.delete({ id: input.attachmentId });
    await this.writeAuditLog({
      userId,
      action: 'attachment_deleted',
      metadata: {
        attachmentId: attachment.id,
        emailId: attachment.emailId,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size ?? null,
      },
    });

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
