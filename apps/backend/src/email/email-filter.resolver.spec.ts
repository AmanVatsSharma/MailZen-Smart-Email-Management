import { Test, TestingModule } from '@nestjs/testing';
import { EmailFilterService } from './email.email-filter.service';
import { EmailFilterResolver } from './email.email-filter.resolver';
import { CreateEmailFilterInput } from './dto/email-filter.input';

describe('EmailFilterResolver', () => {
  let resolver: EmailFilterResolver;
  let service: EmailFilterService;

  // Mock email filter data
  const mockEmailFilter = {
    id: '1',
    userId: 'user-1',
    name: 'Spam Filter',
    conditions: {
      fromEmail: 'spam@example.com',
      subject: 'lottery',
      bodyContains: ['urgent', 'money', 'prize'],
    },
    actions: {
      moveTo: 'SPAM',
      markAs: 'READ',
      forward: false,
    },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock context with user info
  const mockContext = {
    req: {
      user: {
        id: 'user-1',
      },
    },
  };

  // Mock EmailFilterService
  const mockEmailFilterService = {
    createEmailFilter: jest.fn().mockResolvedValue(mockEmailFilter),
    getEmailFilters: jest.fn().mockResolvedValue([mockEmailFilter]),
    getEmailFilterById: jest.fn().mockResolvedValue(mockEmailFilter),
    updateEmailFilter: jest.fn().mockResolvedValue({
      ...mockEmailFilter,
      name: 'Updated Filter',
    }),
    deleteEmailFilter: jest.fn().mockResolvedValue(mockEmailFilter),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailFilterResolver,
        { provide: EmailFilterService, useValue: mockEmailFilterService },
      ],
    }).compile();

    resolver = module.get<EmailFilterResolver>(EmailFilterResolver);
    service = module.get<EmailFilterService>(EmailFilterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createEmailFilter', () => {
    it('should create a new email filter', async () => {
      // Arrange
      const createEmailFilterInput: CreateEmailFilterInput = {
        name: 'Spam Filter',
        conditions: {
          fromEmail: 'spam@example.com',
          subject: 'lottery',
          bodyContains: ['urgent', 'money', 'prize'],
        },
        actions: {
          moveTo: 'SPAM',
          markAs: 'READ',
          forward: false,
        },
        active: true,
      };

      // Act
      const result = await resolver.createEmailFilter(createEmailFilterInput, mockContext);

      // Assert
      expect(service.createEmailFilter).toHaveBeenCalledWith(
        mockContext.req.user.id,
        createEmailFilterInput
      );
      expect(result).toEqual(mockEmailFilter);
    });
  });

  describe('getEmailFilters', () => {
    it('should return all email filters for the authenticated user', async () => {
      // Act
      const result = await resolver.getEmailFilters(mockContext);

      // Assert
      expect(service.getEmailFilters).toHaveBeenCalledWith(mockContext.req.user.id);
      expect(result).toEqual([mockEmailFilter]);
    });
  });

  describe('deleteEmailFilter', () => {
    it('should delete an email filter', async () => {
      // Arrange
      const filterId = '1';

      // Act
      const result = await resolver.deleteEmailFilter(filterId, mockContext);

      // Assert
      expect(service.deleteEmailFilter).toHaveBeenCalledWith(mockContext.req.user.id, filterId);
      expect(result).toEqual(mockEmailFilter);
    });
  });
}); 