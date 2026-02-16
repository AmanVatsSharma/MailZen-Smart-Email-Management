import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailLabel } from '../email/entities/email-label.entity';
import { LabelService } from './label.service';

describe('LabelService', () => {
  let service: LabelService;
  let emailLabelRepo: jest.Mocked<Repository<EmailLabel>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const labelRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailLabel>>;
    const auditRepoMock = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabelService,
        {
          provide: getRepositoryToken(EmailLabel),
          useValue: labelRepoMock,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditRepoMock,
        },
      ],
    }).compile();

    service = module.get<LabelService>(LabelService);
    emailLabelRepo = module.get(getRepositoryToken(EmailLabel));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates label and records audit action', async () => {
    emailLabelRepo.create.mockReturnValue({
      id: 'label-1',
      userId: 'user-1',
      name: 'Important',
      color: '#FF0000',
    } as EmailLabel);
    emailLabelRepo.save.mockResolvedValue({
      id: 'label-1',
      userId: 'user-1',
      name: 'Important',
      color: '#FF0000',
    } as EmailLabel);

    const result = await service.createLabel('user-1', {
      name: 'Important',
      color: '#FF0000',
    });

    expect(result).toEqual({
      id: 'label-1',
      name: 'Important',
      color: '#FF0000',
    });
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'label_created',
      }),
    );
  });

  it('gets labels for user', async () => {
    emailLabelRepo.find.mockResolvedValue([
      {
        id: 'label-1',
        userId: 'user-1',
        name: 'Important',
        color: '#FF0000',
      } as EmailLabel,
    ]);

    const result = await service.getAllLabels('user-1');

    expect(result).toEqual([
      {
        id: 'label-1',
        name: 'Important',
        color: '#FF0000',
      },
    ]);
  });

  it('throws when label id is missing', async () => {
    emailLabelRepo.findOne.mockResolvedValue(null);
    await expect(service.getLabelById('user-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('continues label creation when audit write fails', async () => {
    emailLabelRepo.create.mockReturnValue({
      id: 'label-2',
      userId: 'user-1',
      name: 'Ops',
      color: '#00FF00',
    } as EmailLabel);
    emailLabelRepo.save.mockResolvedValue({
      id: 'label-2',
      userId: 'user-1',
      name: 'Ops',
      color: '#00FF00',
    } as EmailLabel);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.createLabel('user-1', {
      name: 'Ops',
      color: '#00FF00',
    });

    expect(result).toEqual({
      id: 'label-2',
      name: 'Ops',
      color: '#00FF00',
    });
  });
});
