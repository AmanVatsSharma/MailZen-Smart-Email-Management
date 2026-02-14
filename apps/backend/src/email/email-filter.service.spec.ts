import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import {
  CreateEmailFilterInput,
  FilterAction,
  FilterCondition,
} from './dto/email-filter.input';
import { EmailFilterService } from './email.email-filter.service';
import { EmailService } from './email.service';
import { Email } from './entities/email.entity';
import { EmailFilter } from './entities/email-filter.entity';
import { EmailLabelAssignment } from './entities/email-label-assignment.entity';

describe('EmailFilterService', () => {
  let service: EmailFilterService;
  let emailFilterRepo: jest.Mocked<Repository<EmailFilter>>;
  let emailRepo: jest.Mocked<Repository<Email>>;
  let assignmentRepo: jest.Mocked<Repository<EmailLabelAssignment>>;
  let emailService: { markEmailRead: jest.Mock; sendEmail: jest.Mock };

  beforeEach(async () => {
    emailService = {
      markEmailRead: jest.fn(),
      sendEmail: jest.fn(),
    };

    const filterRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailFilter>>;

    const emailRepoMock = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Email>>;

    const assignmentRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<EmailLabelAssignment>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailFilterService,
        { provide: EmailService, useValue: emailService },
        { provide: getRepositoryToken(EmailFilter), useValue: filterRepoMock },
        { provide: getRepositoryToken(Email), useValue: emailRepoMock },
        {
          provide: getRepositoryToken(EmailLabelAssignment),
          useValue: assignmentRepoMock,
        },
      ],
    }).compile();

    service = module.get<EmailFilterService>(EmailFilterService);
    emailFilterRepo = module.get(getRepositoryToken(EmailFilter));
    emailRepo = module.get(getRepositoryToken(Email));
    assignmentRepo = module.get(getRepositoryToken(EmailLabelAssignment));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a filter for a user', async () => {
    const input: CreateEmailFilterInput = {
      name: 'Important sender filter',
      rules: [],
    };
    const created = {
      id: 'filter-1',
      ...input,
      userId: 'user-1',
    } as unknown as EmailFilter;

    emailFilterRepo.create.mockReturnValue(created);
    emailFilterRepo.save.mockResolvedValue(created);

    const result = await service.createFilter(input, 'user-1');

    expect(emailFilterRepo.create).toHaveBeenCalledWith({
      name: input.name,
      rules: input.rules,
      userId: 'user-1',
    });
    expect(emailFilterRepo.save).toHaveBeenCalledWith(created);
    expect(result).toEqual(created);
  });

  it('returns filters ordered by creation date', async () => {
    const rows = [{ id: 'filter-1' }] as EmailFilter[];
    emailFilterRepo.find.mockResolvedValue(rows);

    const result = await service.getFilters('user-1');

    expect(emailFilterRepo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
    expect(result).toEqual(rows);
  });

  it('applies MARK_READ action when a rule matches', async () => {
    emailRepo.findOne.mockResolvedValue({
      id: 'email-1',
      userId: 'user-1',
      subject: 'Urgent: action required',
      providerId: 'provider-1',
      provider: { email: 'sender@example.com' },
    } as any);
    emailFilterRepo.find.mockResolvedValue([
      {
        id: 'filter-1',
        userId: 'user-1',
        rules: [
          {
            field: 'subject',
            condition: FilterCondition.CONTAINS,
            value: 'urgent',
            action: FilterAction.MARK_READ,
          },
        ],
      } as any,
    ]);

    await service.applyFilters('email-1', 'user-1');

    expect(emailService.markEmailRead).toHaveBeenCalledWith('email-1');
    expect(assignmentRepo.save).not.toHaveBeenCalled();
  });
});
