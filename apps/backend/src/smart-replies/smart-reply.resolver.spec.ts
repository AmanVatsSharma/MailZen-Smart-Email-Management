import { Test, TestingModule } from '@nestjs/testing';
import { SmartReplyResolver } from './smart-reply.resolver';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplyInput } from './dto/smart-reply.input';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

describe('SmartReplyResolver', () => {
  let resolver: SmartReplyResolver;
  let service: SmartReplyService;

  // Mock SmartReplyService
  const mockSmartReplyService = {
    generateReply: jest.fn().mockImplementation(async (input) => 'Mocked smart reply'),
    getSuggestedReplies: jest.fn().mockImplementation(async (emailBody, count) => 
      Array(count).fill('').map((_, i) => `Suggestion ${i + 1}`)
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartReplyResolver,
        { provide: SmartReplyService, useValue: mockSmartReplyService },
        JwtAuthGuard,
        { provide: AuthService, useValue: { validateToken: jest.fn().mockReturnValue({ id: 'user-1' }) } },
      ],
    }).compile();

    resolver = module.get<SmartReplyResolver>(SmartReplyResolver);
    service = module.get<SmartReplyService>(SmartReplyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('generateSmartReply', () => {
    it('should call service.generateReply and return the result', async () => {
      // Arrange
      const input: SmartReplyInput = { conversation: 'Test conversation' };
      
      // Act
      const result = await resolver.generateSmartReply(input);
      
      // Assert
      expect(service.generateReply).toHaveBeenCalledWith(input);
      expect(result).toBe('Mocked smart reply');
    });
  });

  describe('getSuggestedReplies', () => {
    it('should call service.getSuggestedReplies with the provided parameters', async () => {
      // Arrange
      const emailBody = 'Test email body';
      const count = 3;
      
      // Act
      const result = await resolver.getSuggestedReplies(emailBody, count);
      
      // Assert
      expect(service.getSuggestedReplies).toHaveBeenCalledWith(emailBody, count);
      expect(result).toEqual(['Suggestion 1', 'Suggestion 2', 'Suggestion 3']);
    });

    it('should use the default count when not explicitly provided', async () => {
      // Arrange
      const emailBody = 'Test email body';
      
      // Act
      await resolver.getSuggestedReplies(emailBody, 3); // 3 is the default value
      
      // Assert
      expect(service.getSuggestedReplies).toHaveBeenCalledWith(emailBody, 3);
    });
  });
}); 