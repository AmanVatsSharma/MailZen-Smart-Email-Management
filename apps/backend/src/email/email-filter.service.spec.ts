import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { EmailFilterService } from './email.email-filter.service';

describe('EmailFilterService (smoke)', () => {
  let service: EmailFilterService;
  let prismaService: any;

  const userId = 'user-1';
  const mockFilter = {
    id: 'f1',
    userId,
    name: 'My Filter',
    rules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      emailFilter: {
        create: jest.fn().mockResolvedValue(mockFilter),
        findMany: jest.fn().mockResolvedValue([mockFilter]),
        findFirst: jest.fn().mockResolvedValue(mockFilter),
        delete: jest.fn().mockResolvedValue(mockFilter),
      },
      emailLabelAssignment: { create: jest.fn() },
      emailLabel: { findMany: jest.fn() },
      emailProvider: { findFirst: jest.fn() },
      emailFolder: { findMany: jest.fn() },
      email: { update: jest.fn(), findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailFilterService,
        { provide: PrismaService, useValue: prismaService },
        { provide: EmailService, useValue: { markEmailRead: jest.fn(), sendEmail: jest.fn() } },
      ],
    }).compile();

    service = module.get(EmailFilterService);
  });

  it('createFilter persists rules JSON', async () => {
    const input = { name: 'My Filter', rules: [] } as any;
    const res = await service.createFilter(input, userId);
    expect(prismaService.emailFilter.create).toHaveBeenCalled();
    expect(res).toEqual(mockFilter);
  });

  it('getFilters returns user filters', async () => {
    const res = await service.getFilters(userId);
    expect(prismaService.emailFilter.findMany).toHaveBeenCalledWith({ where: { userId } });
    expect(res).toEqual([mockFilter]);
  });
});