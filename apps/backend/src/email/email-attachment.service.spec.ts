import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { AttachmentService } from './email.attachment.service';
import { Attachment } from './entities/attachment.entity';
import { Email } from './entities/email.entity';

describe('AttachmentService', () => {
  let service: AttachmentService;
  let attachmentRepo: jest.Mocked<Repository<Attachment>>;
  let emailRepo: jest.Mocked<Repository<Email>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  let mockStorageBucketFile: {
    save: jest.Mock;
    makePublic: jest.Mock;
    delete: jest.Mock;
  };
  let mockStorageBucket: {
    file: jest.Mock;
  };

  beforeEach(() => {
    attachmentRepo = {
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Attachment>>;
    emailRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<Email>>;
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    const configService = {
      get: jest.fn(),
    } as unknown as ConfigService;

    service = new AttachmentService(
      attachmentRepo,
      emailRepo,
      auditLogRepo,
      configService,
    );

    mockStorageBucketFile = {
      save: jest.fn().mockResolvedValue(null),
      makePublic: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(null),
    };
    mockStorageBucket = {
      file: jest.fn().mockReturnValue(mockStorageBucketFile),
    };
    (service as unknown as { storage: { bucket: (name: string) => unknown } })
      .storage = {
      bucket: jest.fn().mockReturnValue(mockStorageBucket),
    };
    (service as unknown as { bucket: string }).bucket = 'mailzen-attachments';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uploads attachment and records audit action', async () => {
    emailRepo.findOne.mockResolvedValue({
      id: 'email-1',
      userId: 'user-1',
    } as Email);
    attachmentRepo.create.mockReturnValue({
      id: 'attachment-1',
      filename: 'report.pdf',
      contentType: 'application/pdf',
      size: 42,
      emailId: 'email-1',
      url: 'https://storage.googleapis.com/mailzen-attachments/user-1/email-1/report.pdf',
    } as Attachment);
    attachmentRepo.save.mockResolvedValue({
      id: 'attachment-1',
      filename: 'report.pdf',
      contentType: 'application/pdf',
      size: 42,
      emailId: 'email-1',
      url: 'https://storage.googleapis.com/mailzen-attachments/user-1/email-1/report.pdf',
    } as Attachment);

    const result = await service.uploadAttachment(
      {
        emailId: 'email-1',
        attachment: {
          filename: 'report.pdf',
          contentType: 'application/pdf',
          content: Buffer.from('file-content').toString('base64'),
          size: 42,
        },
      },
      'user-1',
    );

    expect(mockStorageBucket.file).toHaveBeenCalledWith('user-1/email-1/report.pdf');
    expect(mockStorageBucketFile.save).toHaveBeenCalledTimes(1);
    expect(mockStorageBucketFile.makePublic).toHaveBeenCalledTimes(1);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'attachment_uploaded',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'attachment-1',
      }),
    );
  });

  it('deletes attachment and records audit action', async () => {
    const queryBuilderMock = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'attachment-1',
        emailId: 'email-1',
        filename: 'report.pdf',
        contentType: 'application/pdf',
        size: 42,
        url: 'https://storage.googleapis.com/mailzen-attachments/user-1/email-1/report.pdf',
      } as Attachment),
    };
    attachmentRepo.createQueryBuilder.mockReturnValue(queryBuilderMock as never);
    attachmentRepo.delete.mockResolvedValue({} as never);

    const result = await service.deleteAttachment(
      {
        emailId: 'email-1',
        attachmentId: 'attachment-1',
      },
      'user-1',
    );

    expect(mockStorageBucket.file).toHaveBeenCalledWith('user-1/email-1/report.pdf');
    expect(mockStorageBucketFile.delete).toHaveBeenCalledTimes(1);
    expect(attachmentRepo.delete).toHaveBeenCalledWith({ id: 'attachment-1' });
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'attachment_deleted',
      }),
    );
    expect(result).toBe(true);
  });

  it('throws when upload email ownership is invalid', async () => {
    emailRepo.findOne.mockResolvedValue(null);

    await expect(
      service.uploadAttachment(
        {
          emailId: 'missing',
          attachment: {
            filename: 'report.pdf',
            contentType: 'application/pdf',
            content: Buffer.from('file-content').toString('base64'),
            size: 42,
          },
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('continues delete flow when audit persistence fails', async () => {
    const queryBuilderMock = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'attachment-2',
        emailId: 'email-2',
        filename: 'notes.txt',
        contentType: 'text/plain',
        size: 11,
        url: 'https://storage.googleapis.com/mailzen-attachments/user-1/email-2/notes.txt',
      } as Attachment),
    };
    attachmentRepo.createQueryBuilder.mockReturnValue(queryBuilderMock as never);
    attachmentRepo.delete.mockResolvedValue({} as never);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.deleteAttachment(
      {
        emailId: 'email-2',
        attachmentId: 'attachment-2',
      },
      'user-1',
    );

    expect(result).toBe(true);
  });
});
