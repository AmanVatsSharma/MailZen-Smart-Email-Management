import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Template } from '../template/entities/template.entity';
import { EmailTemplateService } from './email.email-template.service';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  let templateRepo: jest.Mocked<Repository<Template>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const templateRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Template>>;
    const auditRepoMock = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTemplateService,
        {
          provide: getRepositoryToken(Template),
          useValue: templateRepoMock,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditRepoMock,
        },
      ],
    }).compile();

    service = module.get<EmailTemplateService>(EmailTemplateService);
    templateRepo = module.get(getRepositoryToken(Template));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates template and records audit action', async () => {
    const template = {
      id: 'template-1',
      name: 'Welcome',
      subject: 'Welcome',
      body: 'Hello {{name}}',
      userId: 'user-1',
    } as Template;
    templateRepo.create.mockReturnValue(template);
    templateRepo.save.mockResolvedValue(template);

    const result = await service.createTemplate(
      {
        name: 'Welcome',
        subject: 'Welcome',
        body: 'Hello {{name}}',
      },
      'user-1',
    );

    expect(result).toEqual(template);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_template_created',
      }),
    );
  });

  it('updates template and records changed fields', async () => {
    templateRepo.findOne
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Welcome',
        subject: 'Welcome',
        body: 'Hello {{name}}',
        userId: 'user-1',
      } as Template)
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Welcome v2',
        subject: 'Welcome',
        body: 'Hello {{name}}',
        userId: 'user-1',
      } as Template);
    templateRepo.update.mockResolvedValue({} as never);

    const result = await service.updateTemplate(
      'template-1',
      { name: 'Welcome v2' },
      'user-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'template-1',
        name: 'Welcome v2',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_template_updated',
        metadata: expect.objectContaining({
          changedFields: ['name'],
        }),
      }),
    );
  });

  it('deletes template and records audit action', async () => {
    templateRepo.findOne.mockResolvedValue({
      id: 'template-1',
      name: 'Welcome',
      subject: 'Welcome',
      body: 'Hello {{name}}',
      userId: 'user-1',
    } as Template);
    templateRepo.delete.mockResolvedValue({} as never);

    const result = await service.deleteTemplate('template-1', 'user-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'template-1',
      }),
    );
    expect(templateRepo.delete).toHaveBeenCalledWith({ id: 'template-1' });
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'email_template_deleted',
      }),
    );
  });

  it('throws not found when updating missing template', async () => {
    templateRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateTemplate('missing', { name: 'X' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('continues creation when audit write fails', async () => {
    const template = {
      id: 'template-2',
      name: 'Follow up',
      subject: 'Follow up',
      body: 'Body',
      userId: 'user-1',
    } as Template;
    templateRepo.create.mockReturnValue(template);
    templateRepo.save.mockResolvedValue(template);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.createTemplate(
      {
        name: 'Follow up',
        subject: 'Follow up',
        body: 'Body',
      },
      'user-1',
    );

    expect(result).toEqual(template);
  });
});
