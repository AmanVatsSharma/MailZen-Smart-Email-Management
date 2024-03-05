import { Test, TestingModule } from '@nestjs/testing';
import { EmailProviderService } from './email-provider.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmailProviderInput } from './dto/email-provider.input';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  }),
}));

// Mock axios for OAuth calls
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({
    data: {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
    },
  }),
}));

// Mock OAuth2Client
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn().mockResolvedValue({
      credentials: {
        access_token: 'new-google-access-token',
        expiry_date: Date.now() + 3600000,
      },
    }),
  })),
}));

describe('EmailProviderService', () => {
  let service: EmailProviderService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    emailProvider: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<EmailProviderService>(EmailProviderService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('configureProvider', () => {
    it('should auto-detect Gmail provider type', async () => {
      // Arrange
      const input: EmailProviderInput = {
        autoDetect: true,
        email: 'test@gmail.com',
        providerType: 'CUSTOM_SMTP', // This should be overridden
        accessToken: 'access-token',
      } as EmailProviderInput;
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue(null);
      mockPrismaService.emailProvider.create.mockResolvedValue({
        id: 'provider-id',
        type: 'GMAIL',
        email: 'test@gmail.com',
        accessToken: 'access-token',
      });

      // Act
      const result = await service.configureProvider(input, 'user-id');

      // Assert
      expect(result.type).toBe('GMAIL');
      expect(mockPrismaService.emailProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'GMAIL',
            email: 'test@gmail.com',
            accessToken: 'access-token',
          }),
        })
      );
    });

    it('should throw conflict exception for existing provider', async () => {
      // Arrange
      const input: EmailProviderInput = {
        providerType: 'GMAIL',
        email: 'test@gmail.com',
        accessToken: 'access-token',
      } as EmailProviderInput;
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue({
        id: 'existing-id',
        type: 'GMAIL',
        email: 'test@gmail.com',
      });

      // Act & Assert
      await expect(service.configureProvider(input, 'user-id')).rejects.toThrow(ConflictException);
    });

    it('should throw bad request for invalid SMTP configuration', async () => {
      // Arrange
      const input: EmailProviderInput = {
        providerType: 'CUSTOM_SMTP',
        email: 'test@example.com',
        // Missing host, port, and password
      } as EmailProviderInput;
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.configureProvider(input, 'user-id')).rejects.toThrow(BadRequestException);
    });

    it('should throw bad request for unsupported provider type', async () => {
      // Arrange
      const input: EmailProviderInput = {
        providerType: 'UNKNOWN',
        email: 'test@example.com',
      } as EmailProviderInput;
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.configureProvider(input, 'user-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('detectProviderType', () => {
    it('should detect Gmail from email', () => {
      // Act
      const result = service['detectProviderType']('test@gmail.com');
      
      // Assert
      expect(result).toBe('GMAIL');
    });

    it('should detect Outlook from email', () => {
      // Act
      const result = service['detectProviderType']('test@outlook.com');
      
      // Assert
      expect(result).toBe('OUTLOOK');
    });

    it('should detect Hotmail as Outlook', () => {
      // Act
      const result = service['detectProviderType']('test@hotmail.com');
      
      // Assert
      expect(result).toBe('OUTLOOK');
    });

    it('should default to CUSTOM_SMTP for unknown domains', () => {
      // Act
      const result = service['detectProviderType']('test@example.com');
      
      // Assert
      expect(result).toBe('CUSTOM_SMTP');
    });
  });

  describe('getProviderEmails', () => {
    it('should return emails for a valid provider', async () => {
      // Arrange
      const providerId = 'provider-id';
      const mockEmails = [{ id: 'email-1' }, { id: 'email-2' }];
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue({
        id: providerId,
        emails: mockEmails,
      });

      // Act
      const result = await service.getProviderEmails(providerId, 'user-id');

      // Assert
      expect(result).toEqual(mockEmails);
      expect(mockPrismaService.emailProvider.findFirst).toHaveBeenCalledWith({
        where: { id: providerId, userId: 'user-id' },
        include: { emails: true },
      });
    });

    it('should throw not found for non-existent provider', async () => {
      // Arrange
      mockPrismaService.emailProvider.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProviderEmails('invalid-id', 'user-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllProviders', () => {
    it('should return all providers for a user', async () => {
      // Arrange
      const mockProviders = [
        { id: 'provider-1', type: 'GMAIL' },
        { id: 'provider-2', type: 'OUTLOOK' },
      ];
      
      mockPrismaService.emailProvider.findMany.mockResolvedValue(mockProviders);

      // Act
      const result = await service.getAllProviders('user-id');

      // Assert
      expect(result).toEqual(mockProviders);
      expect(mockPrismaService.emailProvider.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getProviderById', () => {
    it('should return provider by ID', async () => {
      // Arrange
      const providerId = 'provider-id';
      const mockProvider = { id: providerId, type: 'GMAIL' };
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue(mockProvider);

      // Act
      const result = await service.getProviderById(providerId, 'user-id');

      // Assert
      expect(result).toEqual(mockProvider);
      expect(mockPrismaService.emailProvider.findFirst).toHaveBeenCalledWith({
        where: { id: providerId, userId: 'user-id' },
      });
    });

    it('should throw not found for non-existent provider', async () => {
      // Arrange
      mockPrismaService.emailProvider.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProviderById('invalid-id', 'user-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProvider', () => {
    it('should delete an existing provider', async () => {
      // Arrange
      const providerId = 'provider-id';
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue({
        id: providerId,
        type: 'GMAIL',
      });
      
      mockPrismaService.emailProvider.delete.mockResolvedValue({ id: providerId });

      // Act
      const result = await service.deleteProvider(providerId, 'user-id');

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.emailProvider.delete).toHaveBeenCalledWith({
        where: { id: providerId },
      });
    });

    it('should throw not found for non-existent provider', async () => {
      // Arrange
      mockPrismaService.emailProvider.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteProvider('invalid-id', 'user-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.emailProvider.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateProviderCredentials', () => {
    it('should update SMTP provider credentials', async () => {
      // Arrange
      const providerId = 'provider-id';
      const updateData = {
        host: 'new-host.com',
        port: 587,
        password: 'new-password',
      };
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue({
        id: providerId,
        type: 'CUSTOM_SMTP',
      });
      
      mockPrismaService.emailProvider.update.mockResolvedValue({
        id: providerId,
        ...updateData,
      });

      // Act
      const result = await service.updateProviderCredentials(providerId, updateData, 'user-id');

      // Assert
      expect(result.id).toBe(providerId);
      expect(mockPrismaService.emailProvider.update).toHaveBeenCalledWith({
        where: { id: providerId },
        data: expect.objectContaining({
          host: 'new-host.com',
          port: 587,
          password: 'new-password',
        }),
      });
    });

    it('should update OAuth provider credentials', async () => {
      // Arrange
      const providerId = 'provider-id';
      const updateData = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        tokenExpiry: Date.now() + 3600000,
      };
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue({
        id: providerId,
        type: 'GMAIL',
      });
      
      mockPrismaService.emailProvider.update.mockResolvedValue({
        id: providerId,
        type: 'GMAIL',
        accessToken: 'new-token',
      });

      // Act
      const result = await service.updateProviderCredentials(providerId, updateData, 'user-id');

      // Assert
      expect(result.id).toBe(providerId);
      expect(mockPrismaService.emailProvider.update).toHaveBeenCalledWith({
        where: { id: providerId },
        data: expect.objectContaining({
          accessToken: 'new-token',
          refreshToken: 'new-refresh',
        }),
      });
    });

    it('should throw not found for non-existent provider', async () => {
      // Arrange
      mockPrismaService.emailProvider.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateProviderCredentials('invalid-id', {}, 'user-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateProvider', () => {
    it('should return valid status for working provider', async () => {
      // Arrange
      const providerId = 'provider-id';
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue({
        id: providerId,
        type: 'GMAIL',
        email: 'test@gmail.com',
        accessToken: 'token',
      });
      
      // nodemailer.createTransport().verify is mocked to return true

      // Act
      const result = await service.validateProvider(providerId, 'user-id');

      // Assert
      expect(result.valid).toBe(true);
      expect(result.message).toBe('Provider connection validated successfully');
    });

    it('should return invalid status when verification fails', async () => {
      // Arrange
      const providerId = 'provider-id';
      
      mockPrismaService.emailProvider.findFirst.mockResolvedValue({
        id: providerId,
        type: 'GMAIL',
        email: 'test@gmail.com',
        accessToken: 'token',
      });
      
      // Override the default mock for this test
      (nodemailer.createTransport as jest.Mock).mockReturnValueOnce({
        verify: jest.fn().mockRejectedValue(new Error('Authentication failed')),
        close: jest.fn(),
      });

      // Act
      const result = await service.validateProvider(providerId, 'user-id');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Authentication failed');
    });
  });

  describe('getTransporter', () => {
    it('should create and cache Gmail transporter', async () => {
      // Arrange
      const provider = {
        id: 'provider-id',
        type: 'GMAIL',
        email: 'test@gmail.com',
        accessToken: 'token',
      };

      // Act
      const transporter = await service['getTransporter'](provider);

      // Assert
      expect(transporter).toBeDefined();
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'gmail',
          auth: expect.objectContaining({
            type: 'OAuth2',
            user: 'test@gmail.com',
            accessToken: 'token',
          }),
        })
      );
    });

    it('should create and cache SMTP transporter', async () => {
      // Arrange
      const provider = {
        id: 'provider-id',
        type: 'CUSTOM_SMTP',
        email: 'test@example.com',
        host: 'smtp.example.com',
        port: 587,
        password: 'password',
      };

      // Act
      const transporter = await service['getTransporter'](provider);

      // Assert
      expect(transporter).toBeDefined();
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          auth: expect.objectContaining({
            user: 'test@example.com',
            pass: 'password',
          }),
          pool: true,
        })
      );
    });
  });
}); 