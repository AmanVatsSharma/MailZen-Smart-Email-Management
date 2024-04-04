import { Test, TestingModule } from '@nestjs/testing';
import { SmartReplyService } from './smart-reply.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { SmartReplyInput } from './dto/smart-reply.input';

// Create a mock for PrismaService
const mockPrismaService = {
  conversationLog: {
    create: jest.fn(),
  },
};

// Create a mock for Logger
jest.mock('@nestjs/common', () => {
  const originalModule = jest.requireActual('@nestjs/common');
  return {
    ...originalModule,
    Logger: jest.fn().mockImplementation(() => ({
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  };
});

describe('SmartReplyService', () => {
  let service: SmartReplyService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartReplyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SmartReplyService>(SmartReplyService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateReply', () => {
    it('should return a smart reply string', async () => {
      // Arrange
      const input: SmartReplyInput = { conversation: 'Hello, how are you?' };
      
      // Act
      const result = await service.generateReply(input);
      
      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should log the conversation and call storeConversation', async () => {
      // Arrange
      const input: SmartReplyInput = { conversation: 'Test conversation' };
      const storeConversationSpy = jest.spyOn(service as any, 'storeConversation');
      
      // Act
      await service.generateReply(input);
      
      // Assert
      expect(storeConversationSpy).toHaveBeenCalledWith('Test conversation');
    });

    it('should handle errors and return a fallback message', async () => {
      // Arrange
      const input: SmartReplyInput = { conversation: 'Test conversation' };
      jest.spyOn(service as any, 'storeConversation').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Act
      const result = await service.generateReply(input);
      
      // Assert
      expect(result).toBe("I'm sorry, I couldn't generate a reply at this time.");
    });
  });

  describe('getSuggestedReplies', () => {
    it('should return an array of suggested replies', async () => {
      // Arrange
      const emailBody = 'When can we meet to discuss the project?';
      const count = 3;
      
      // Act
      const result = await service.getSuggestedReplies(emailBody, count);
      
      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(count);
      result.forEach(reply => {
        expect(typeof reply).toBe('string');
      });
    });

    it('should limit the number of replies to the count specified', async () => {
      // Arrange
      const emailBody = 'Example email';
      const count = 2;
      
      // Act
      const result = await service.getSuggestedReplies(emailBody, count);
      
      // Assert
      expect(result.length).toBe(count);
    });

    it('should use default count when not specified', async () => {
      // Arrange
      const emailBody = 'Example email';
      
      // Act
      const result = await service.getSuggestedReplies(emailBody);
      
      // Assert
      expect(result.length).toBe(3); // Default count is 3
    });
  });
}); 