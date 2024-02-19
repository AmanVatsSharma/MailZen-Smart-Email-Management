import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { EmailFilterService } from './email.email-filter.service';

describe('EmailFilterService', () => {
  let service: EmailFilterService;
  let prismaService: PrismaService;

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

  // Mock PrismaService
  const mockPrismaService = {
    emailFilter: {
      create: jest.fn().mockResolvedValue(mockEmailFilter),
      findMany: jest.fn().mockResolvedValue([mockEmailFilter]),
      findUnique: jest.fn().mockImplementation((params) => {
        if (params.where.id === '1' && params.where.userId === 'user-1') {
          return Promise.resolve(mockEmailFilter);
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue({
        ...mockEmailFilter,
        name: 'Updated Filter',
      }),
      delete: jest.fn().mockResolvedValue(mockEmailFilter),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailFilterService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<EmailFilterService>(EmailFilterService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmailFilter', () => {
    it('should create a new email filter', async () => {
      // Arrange
      const userId = 'user-1';
      const createEmailFilterInput = {
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
      const result = await service.createEmailFilter(userId, createEmailFilterInput);

      // Assert
      expect(prismaService.emailFilter.create).toHaveBeenCalledWith({
        data: {
          ...createEmailFilterInput,
          userId,
        },
      });
      expect(result).toEqual(mockEmailFilter);
    });
  });

  describe('getEmailFilters', () => {
    it('should return all email filters for a user', async () => {
      // Arrange
      const userId = 'user-1';

      // Act
      const result = await service.getEmailFilters(userId);

      // Assert
      expect(prismaService.emailFilter.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual([mockEmailFilter]);
    });
  });

  describe('getEmailFilterById', () => {
    it('should return an email filter by id', async () => {
      // Arrange
      const userId = 'user-1';
      const filterId = '1';

      // Act
      const result = await service.getEmailFilterById(userId, filterId);

      // Assert
      expect(prismaService.emailFilter.findUnique).toHaveBeenCalledWith({
        where: { id: filterId, userId },
      });
      expect(result).toEqual(mockEmailFilter);
    });

    it('should throw NotFoundException when filter not found', async () => {
      // Arrange
      const userId = 'user-1';
      const filterId = 'non-existent';

      // Mock findUnique to return null for non-existent id
      jest.spyOn(prismaService.emailFilter, 'findUnique').mockResolvedValueOnce(null);

      // Act and Assert
      await expect(service.getEmailFilterById(userId, filterId)).rejects.toThrow(
        NotFoundException
      );
      expect(prismaService.emailFilter.findUnique).toHaveBeenCalledWith({
        where: { id: filterId, userId },
      });
    });
  });

  describe('updateEmailFilter', () => {
    it('should update an existing email filter', async () => {
      // Arrange
      const userId = 'user-1';
      const filterId = '1';
      const updateData = {
        name: 'Updated Filter',
      };

      // Mock findUnique for the filter existence check
      jest.spyOn(prismaService.emailFilter, 'findUnique').mockResolvedValueOnce(mockEmailFilter);

      // Act
      const result = await service.updateEmailFilter(userId, filterId, updateData);

      // Assert
      expect(prismaService.emailFilter.findUnique).toHaveBeenCalledWith({
        where: { id: filterId, userId },
      });
      expect(prismaService.emailFilter.update).toHaveBeenCalledWith({
        where: { id: filterId, userId },
        data: updateData,
      });
      expect(result.name).toBe('Updated Filter');
    });

    it('should throw NotFoundException when trying to update non-existent filter', async () => {
      // Arrange
      const userId = 'user-1';
      const filterId = 'non-existent';
      const updateData = {
        name: 'Updated Filter',
      };

      // Mock findUnique to return null for non-existent id
      jest.spyOn(prismaService.emailFilter, 'findUnique').mockResolvedValueOnce(null);

      // Act and Assert
      await expect(service.updateEmailFilter(userId, filterId, updateData)).rejects.toThrow(
        NotFoundException
      );
      expect(prismaService.emailFilter.findUnique).toHaveBeenCalledWith({
        where: { id: filterId, userId },
      });
      expect(prismaService.emailFilter.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteEmailFilter', () => {
    it('should delete an email filter', async () => {
      // Arrange
      const userId = 'user-1';
      const filterId = '1';

      // Mock findUnique for the filter existence check
      jest.spyOn(prismaService.emailFilter, 'findUnique').mockResolvedValueOnce(mockEmailFilter);

      // Act
      const result = await service.deleteEmailFilter(userId, filterId);

      // Assert
      expect(prismaService.emailFilter.findUnique).toHaveBeenCalledWith({
        where: { id: filterId, userId },
      });
      expect(prismaService.emailFilter.delete).toHaveBeenCalledWith({
        where: { id: filterId, userId },
      });
      expect(result).toEqual(mockEmailFilter);
    });

    it('should throw NotFoundException when trying to delete non-existent filter', async () => {
      // Arrange
      const userId = 'user-1';
      const filterId = 'non-existent';

      // Mock findUnique to return null for non-existent id
      jest.spyOn(prismaService.emailFilter, 'findUnique').mockResolvedValueOnce(null);

      // Act and Assert
      await expect(service.deleteEmailFilter(userId, filterId)).rejects.toThrow(
        NotFoundException
      );
      expect(prismaService.emailFilter.findUnique).toHaveBeenCalledWith({
        where: { id: filterId, userId },
      });
      expect(prismaService.emailFilter.delete).not.toHaveBeenCalled();
    });
  });
}); 