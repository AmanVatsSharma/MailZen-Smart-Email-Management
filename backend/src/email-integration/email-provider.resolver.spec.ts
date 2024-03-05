import { Test, TestingModule } from '@nestjs/testing';
import { EmailProviderResolver } from './email-provider.resolver';
import { EmailProviderService } from './email-provider.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

// Mock JwtAuthGuard
jest.mock('../common/guards/jwt-auth.guard', () => {
  return {
    JwtAuthGuard: jest.fn().mockImplementation(() => {
      return {
        canActivate: jest.fn().mockReturnValue(true),
      };
    }),
  };
});

describe('EmailProviderResolver', () => {
  let resolver: EmailProviderResolver;
  
  const mockEmailProviderService = {
    configureProvider: jest.fn(),
    getProviderEmails: jest.fn(),
    getAllProviders: jest.fn(),
    getProviderById: jest.fn(),
    deleteProvider: jest.fn(),
    updateProviderCredentials: jest.fn(),
    validateProvider: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderResolver,
        { provide: EmailProviderService, useValue: mockEmailProviderService },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    resolver = module.get<EmailProviderResolver>(EmailProviderResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('configureEmailProvider', () => {
    it('should call service.configureProvider with correct parameters', async () => {
      // Arrange
      const mockInput = {
        providerType: 'GMAIL',
        email: 'test@gmail.com',
        accessToken: 'token'
      };
      const mockContext = { req: { user: { id: 'user-id' } } };
      const mockProvider = { id: 'provider-id', type: 'GMAIL', email: 'test@gmail.com' };
      mockEmailProviderService.configureProvider.mockResolvedValue(mockProvider);

      // Act
      const result = await resolver.configureEmailProvider(mockInput, mockContext);

      // Assert
      expect(result).toEqual(mockProvider);
      expect(mockEmailProviderService.configureProvider).toHaveBeenCalledWith(mockInput, 'user-id');
    });
  });

  describe('getProviderEmails', () => {
    it('should call service.getProviderEmails with correct parameters', async () => {
      // Arrange
      const providerId = 'provider-id';
      const mockContext = { req: { user: { id: 'user-id' } } };
      const mockEmails = [{ id: 'email-1' }, { id: 'email-2' }];
      mockEmailProviderService.getProviderEmails.mockResolvedValue(mockEmails);

      // Act
      const result = await resolver.getProviderEmails(providerId, mockContext);

      // Assert
      expect(result).toEqual(mockEmails);
      expect(mockEmailProviderService.getProviderEmails).toHaveBeenCalledWith(providerId, 'user-id');
    });
  });

  describe('getAllProviders', () => {
    it('should call service.getAllProviders with userId from context', async () => {
      // Arrange
      const mockContext = { req: { user: { id: 'user-id' } } };
      const mockProviders = [
        { id: 'provider-1', type: 'GMAIL' },
        { id: 'provider-2', type: 'OUTLOOK' },
      ];
      mockEmailProviderService.getAllProviders.mockResolvedValue(mockProviders);

      // Act
      const result = await resolver.getAllProviders(mockContext);

      // Assert
      expect(result).toEqual(mockProviders);
      expect(mockEmailProviderService.getAllProviders).toHaveBeenCalledWith('user-id');
    });
  });

  describe('getProviderById', () => {
    it('should call service.getProviderById with correct parameters', async () => {
      // Arrange
      const providerId = 'provider-id';
      const mockContext = { req: { user: { id: 'user-id' } } };
      const mockProvider = { id: providerId, type: 'GMAIL' };
      mockEmailProviderService.getProviderById.mockResolvedValue(mockProvider);

      // Act
      const result = await resolver.getProviderById(providerId, mockContext);

      // Assert
      expect(result).toEqual(mockProvider);
      expect(mockEmailProviderService.getProviderById).toHaveBeenCalledWith(providerId, 'user-id');
    });
  });

  describe('deleteProvider', () => {
    it('should call service.deleteProvider with correct parameters', async () => {
      // Arrange
      const mockInput = { id: 'provider-id' };
      const mockContext = { req: { user: { id: 'user-id' } } };
      mockEmailProviderService.deleteProvider.mockResolvedValue(true);

      // Act
      const result = await resolver.deleteProvider(mockInput, mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockEmailProviderService.deleteProvider).toHaveBeenCalledWith('provider-id', 'user-id');
    });
  });

  describe('updateProviderCredentials', () => {
    it('should call service.updateProviderCredentials with correct parameters', async () => {
      // Arrange
      const providerId = 'provider-id';
      const mockInput = {
        providerType: 'GMAIL',
        email: 'test@gmail.com',
        accessToken: 'new-token',
      };
      const mockContext = { req: { user: { id: 'user-id' } } };
      const mockProvider = { id: providerId, type: 'GMAIL', accessToken: 'new-token' };
      mockEmailProviderService.updateProviderCredentials.mockResolvedValue(mockProvider);

      // Act
      const result = await resolver.updateProviderCredentials(providerId, mockInput, mockContext);

      // Assert
      expect(result).toEqual(mockProvider);
      expect(mockEmailProviderService.updateProviderCredentials).toHaveBeenCalledWith(
        providerId,
        mockInput,
        'user-id'
      );
    });
  });

  describe('validateProvider', () => {
    it('should call service.validateProvider and return valid status', async () => {
      // Arrange
      const providerId = 'provider-id';
      const mockContext = { req: { user: { id: 'user-id' } } };
      mockEmailProviderService.validateProvider.mockResolvedValue({
        valid: true,
        message: 'Provider connection validated successfully',
      });

      // Act
      const result = await resolver.validateProvider(providerId, mockContext);

      // Assert
      expect(result).toBe(true);
      expect(mockEmailProviderService.validateProvider).toHaveBeenCalledWith(providerId, 'user-id');
    });
  });
}); 