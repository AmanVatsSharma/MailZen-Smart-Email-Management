/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
    generateReply: jest
      .fn()
      .mockImplementation(() => Promise.resolve('Mocked smart reply')),
    getSuggestedReplies: jest.fn().mockImplementation((_emailBody, count) =>
      Promise.resolve(
        Array(count)
          .fill('')
          .map((_, i) => `Suggestion ${i + 1}`),
      ),
    ),
    getSettings: jest.fn().mockResolvedValue({
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
    }),
    updateSettings: jest.fn().mockResolvedValue({
      id: 'settings-1',
      userId: 'user-1',
      enabled: false,
    }),
    listHistory: jest.fn().mockResolvedValue([]),
    purgeHistory: jest.fn().mockResolvedValue({ purgedRows: 0 }),
    exportSmartReplyData: jest.fn().mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"ok":true}',
    }),
    exportSmartReplyDataForAdmin: jest.fn().mockResolvedValue({
      generatedAtIso: '2026-02-16T00:30:00.000Z',
      dataJson: '{"ok":true}',
    }),
    getProviderHealthSummary: jest.fn().mockResolvedValue({
      mode: 'hybrid',
      hybridPrimary: 'openai',
      providers: [
        {
          providerId: 'template',
          enabled: true,
          configured: true,
          priority: 999,
          note: 'deterministic fallback provider',
        },
      ],
      executedAtIso: '2026-02-16T00:00:00.000Z',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartReplyResolver,
        { provide: SmartReplyService, useValue: mockSmartReplyService },
        JwtAuthGuard,
        {
          provide: AuthService,
          useValue: {
            validateToken: jest.fn().mockReturnValue({ id: 'user-1' }),
          },
        },
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
      const context = { req: { user: { id: 'user-1' } } };

      // Act
      const result = await resolver.generateSmartReply(input, context as any);

      // Assert
      expect(service.generateReply).toHaveBeenCalledWith(input, 'user-1');
      expect(result).toBe('Mocked smart reply');
    });
  });

  describe('getSuggestedReplies', () => {
    it('should call service.getSuggestedReplies with the provided parameters', async () => {
      // Arrange
      const emailBody = 'Test email body';
      const count = 3;
      const context = { req: { user: { id: 'user-1' } } };

      // Act
      const result = await resolver.getSuggestedReplies(
        emailBody,
        count,
        context as any,
      );

      // Assert
      expect(service.getSuggestedReplies).toHaveBeenCalledWith(
        emailBody,
        count,
        'user-1',
      );
      expect(result).toEqual(['Suggestion 1', 'Suggestion 2', 'Suggestion 3']);
    });

    it('should use the default count when not explicitly provided', async () => {
      // Arrange
      const emailBody = 'Test email body';
      const context = { req: { user: { id: 'user-1' } } };

      // Act
      await resolver.getSuggestedReplies(emailBody, 3, context as any); // 3 is the default value

      // Assert
      expect(service.getSuggestedReplies).toHaveBeenCalledWith(
        emailBody,
        3,
        'user-1',
      );
    });
  });

  describe('history APIs', () => {
    it('should return smart reply history for current user', async () => {
      const context = { req: { user: { id: 'user-1' } } };
      mockSmartReplyService.listHistory.mockResolvedValue([
        {
          id: 'history-1',
          userId: 'user-1',
          conversationPreview: 'Need timeline update',
          suggestions: ['Sure, sharing timeline shortly.'],
        },
      ]);

      await expect(
        resolver.mySmartReplyHistory(10, context as any),
      ).resolves.toEqual([
        expect.objectContaining({
          id: 'history-1',
        }),
      ]);
      expect(mockSmartReplyService.listHistory).toHaveBeenCalledWith(
        'user-1',
        10,
      );
    });

    it('should purge smart reply history for current user', async () => {
      const context = { req: { user: { id: 'user-1' } } };
      mockSmartReplyService.purgeHistory.mockResolvedValue({
        purgedRows: 4,
      });

      await expect(
        resolver.purgeMySmartReplyHistory(context as any),
      ).resolves.toEqual(
        expect.objectContaining({
          purgedRows: 4,
          executedAtIso: expect.any(String),
        }),
      );
      expect(mockSmartReplyService.purgeHistory).toHaveBeenCalledWith('user-1');
    });

    it('should export smart reply data for current user', async () => {
      const context = { req: { user: { id: 'user-1' } } };

      await expect(
        resolver.mySmartReplyDataExport(150, context as any),
      ).resolves.toEqual(
        expect.objectContaining({
          generatedAtIso: '2026-02-16T00:00:00.000Z',
          dataJson: '{"ok":true}',
        }),
      );
      expect(mockSmartReplyService.exportSmartReplyData).toHaveBeenCalledWith(
        'user-1',
        150,
      );
    });

    it('should export smart reply data for target user as admin', async () => {
      const context = { req: { user: { id: 'admin-1' } } };

      await expect(
        resolver.userSmartReplyDataExport('user-2', 120, context as any),
      ).resolves.toEqual(
        expect.objectContaining({
          generatedAtIso: '2026-02-16T00:30:00.000Z',
          dataJson: '{"ok":true}',
        }),
      );
      expect(
        mockSmartReplyService.exportSmartReplyDataForAdmin,
      ).toHaveBeenCalledWith({
        targetUserId: 'user-2',
        actorUserId: 'admin-1',
        limit: 120,
      });
    });

    it('should return provider health summary', async () => {
      await expect(resolver.mySmartReplyProviderHealth()).resolves.toEqual(
        expect.objectContaining({
          mode: 'hybrid',
          hybridPrimary: 'openai',
        }),
      );
      expect(mockSmartReplyService.getProviderHealthSummary).toHaveBeenCalled();
    });
  });
});
