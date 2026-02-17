/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DeleteResult, Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { SmartReplyHistory } from './entities/smart-reply-history.entity';
import { SmartReplyProviderRouter } from './smart-reply-provider.router';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';

describe('SmartReplyService', () => {
  let service: SmartReplyService;
  let settingsRepo: jest.Mocked<Repository<SmartReplySettings>>;
  let historyRepo: jest.Mocked<Repository<SmartReplyHistory>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  let providerRouter: jest.Mocked<SmartReplyProviderRouter>;

  beforeEach(async () => {
    const repoMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
    } as unknown as jest.Mocked<Repository<SmartReplySettings>>;
    const historyRepoMock = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<SmartReplyHistory>>;
    const providerRouterMock = {
      generateSuggestions: jest.fn(),
      getProviderHealthSnapshot: jest.fn(),
    } as unknown as jest.Mocked<SmartReplyProviderRouter>;
    const auditLogRepoMock = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartReplyService,
        { provide: getRepositoryToken(SmartReplySettings), useValue: repoMock },
        {
          provide: getRepositoryToken(SmartReplyHistory),
          useValue: historyRepoMock,
        },
        { provide: getRepositoryToken(AuditLog), useValue: auditLogRepoMock },
        { provide: SmartReplyProviderRouter, useValue: providerRouterMock },
      ],
    }).compile();

    service = module.get<SmartReplyService>(SmartReplyService);
    settingsRepo = module.get(getRepositoryToken(SmartReplySettings));
    historyRepo = module.get(getRepositoryToken(SmartReplyHistory));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
    providerRouter = module.get(SmartReplyProviderRouter);
    historyRepo.create.mockImplementation(
      (value) => value as SmartReplyHistory,
    );
    historyRepo.save.mockImplementation((value) =>
      Promise.resolve(value as SmartReplyHistory),
    );
    historyRepo.delete.mockResolvedValue({ affected: 0 } as DeleteResult);
    historyRepo.find.mockResolvedValue([]);
    providerRouter.getProviderHealthSnapshot.mockReturnValue({
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
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('generates deterministic reply from model provider', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
      defaultTone: 'professional',
      defaultLength: 'medium',
      includeSignature: false,
      maxSuggestions: 3,
    } as SmartReplySettings);
    providerRouter.generateSuggestions.mockResolvedValue({
      suggestions: ['Deterministic suggestion', 'Alternative'],
      source: 'internal',
      fallbackUsed: false,
    });

    const result = await service.generateReply(
      {
        conversation: 'Can you confirm the timeline for delivery?',
      },
      'user-1',
    );

    expect(providerRouter.generateSuggestions).toHaveBeenCalled();
    expect(result).toBe('Deterministic suggestion');
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        source: 'internal',
      }),
    );
  });

  it('returns safety reply when sensitive content is present', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
      defaultTone: 'professional',
      defaultLength: 'medium',
      includeSignature: false,
      maxSuggestions: 3,
    } as SmartReplySettings);

    const result = await service.generateReply(
      {
        conversation: 'Here is my password 1234, please use it.',
      },
      'user-1',
    );

    expect(providerRouter.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toContain('security reasons');
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        blockedSensitive: true,
      }),
    );
  });

  it('returns existing settings when present', async () => {
    const existing = {
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
    } as SmartReplySettings;
    settingsRepo.findOne.mockResolvedValue(existing);

    const result = await service.getSettings('user-1');

    expect(settingsRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(result).toBe(existing);
  });

  it('creates default settings when no row exists', async () => {
    const created = {
      id: 'settings-1',
      userId: 'user-1',
    } as SmartReplySettings;
    settingsRepo.findOne.mockResolvedValue(null);
    settingsRepo.create.mockReturnValue(created);
    settingsRepo.save.mockResolvedValue(created);

    const result = await service.getSettings('user-1');

    expect(settingsRepo.create).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(settingsRepo.save).toHaveBeenCalledWith(created);
    expect(result).toEqual(created);
  });

  it('updates settings with merged values', async () => {
    const existing = {
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
      maxSuggestions: 3,
    } as SmartReplySettings;
    const merged = {
      ...existing,
      enabled: false,
      maxSuggestions: 5,
    } as SmartReplySettings;

    settingsRepo.findOne.mockResolvedValue(existing);
    settingsRepo.merge.mockReturnValue(merged);
    settingsRepo.save.mockResolvedValue(merged);

    const result = await service.updateSettings('user-1', {
      enabled: false,
      maxSuggestions: 5,
    });

    expect(settingsRepo.merge).toHaveBeenCalled();
    expect(settingsRepo.save).toHaveBeenCalledWith(merged);
    expect(result).toEqual(merged);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'smart_reply_settings_updated',
      }),
    );
  });

  it('uses maxSuggestions cap when generating suggestions', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
      defaultTone: 'friendly',
      defaultLength: 'short',
      includeSignature: false,
      maxSuggestions: 2,
    } as SmartReplySettings);
    providerRouter.generateSuggestions.mockResolvedValue({
      suggestions: ['One', 'Two'],
      source: 'internal',
      fallbackUsed: false,
    });

    const result = await service.getSuggestedReplies(
      'Can we schedule a meeting?',
      5,
      'user-1',
    );

    expect(providerRouter.generateSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ count: 2 }),
      }),
    );
    expect(result).toEqual(['One', 'Two']);
  });

  it('prefers external model suggestions for advanced model settings', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
      defaultTone: 'professional',
      defaultLength: 'medium',
      includeSignature: false,
      maxSuggestions: 3,
      aiModel: 'advanced',
    } as SmartReplySettings);
    providerRouter.generateSuggestions.mockResolvedValue({
      suggestions: ['External model suggestion'],
      source: 'external',
      fallbackUsed: false,
    });

    const result = await service.generateReply(
      { conversation: 'Need update on proposal status.' },
      'user-1',
    );

    expect(providerRouter.generateSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        aiModel: 'advanced',
      }),
    );
    expect(result).toBe('External model suggestion');
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'external',
      }),
    );
  });

  it('does not persist history when keepHistory disabled', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
      defaultTone: 'professional',
      defaultLength: 'medium',
      includeSignature: false,
      maxSuggestions: 3,
      keepHistory: false,
    } as SmartReplySettings);
    providerRouter.generateSuggestions.mockResolvedValue({
      suggestions: ['Reply one'],
      source: 'internal',
      fallbackUsed: false,
    });

    await service.generateReply(
      {
        conversation: 'Can we close this by tomorrow?',
      },
      'user-1',
    );

    expect(historyRepo.save).not.toHaveBeenCalled();
  });

  it('lists smart reply history for current user with bounded limit', async () => {
    historyRepo.find.mockResolvedValue([
      {
        id: 'history-1',
        userId: 'user-1',
      } as SmartReplyHistory,
    ]);

    const result = await service.listHistory('user-1', 1000);

    expect(historyRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 100,
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('purges smart reply history for current user', async () => {
    historyRepo.delete.mockResolvedValue({ affected: 7 } as DeleteResult);

    const result = await service.purgeHistory('user-1');

    expect(historyRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result).toEqual({ purgedRows: 7 });
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'smart_reply_history_purged',
      }),
    );
  });

  it('purges smart reply history by retention policy', async () => {
    historyRepo.delete.mockResolvedValue({ affected: 9 } as DeleteResult);

    const result = await service.purgeHistoryByRetentionPolicy({
      retentionDays: 45,
    });

    expect(historyRepo.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        createdAt: expect.anything(),
      }),
    );
    expect(result).toEqual({
      deletedRows: 9,
      retentionDays: 45,
    });
  });

  it('clamps retention purge days when configured below minimum', async () => {
    historyRepo.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

    const result = await service.purgeHistoryByRetentionPolicy({
      retentionDays: 0,
    });

    expect(result.retentionDays).toBe(1);
  });

  it('exports smart reply settings and history payload', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'settings-1',
      userId: 'user-1',
      enabled: true,
      defaultTone: 'professional',
      defaultLength: 'medium',
      aiModel: 'balanced',
      includeSignature: true,
      personalization: 80,
      creativityLevel: 45,
      maxSuggestions: 3,
      customInstructions: 'Keep it concise',
      keepHistory: true,
      historyLength: 30,
    } as SmartReplySettings);
    historyRepo.find.mockResolvedValue([
      {
        id: 'history-1',
        userId: 'user-1',
        conversationPreview: 'Need timeline update',
        suggestions: ['Sharing timeline shortly.'],
        source: 'internal',
        blockedSensitive: false,
        fallbackUsed: false,
        createdAt: new Date('2026-02-16T00:00:00.000Z'),
      } as SmartReplyHistory,
    ]);

    const result = await service.exportSmartReplyData('user-1', 9999);
    const parsedPayload: unknown = JSON.parse(result.dataJson);
    const payload = parsedPayload as {
      history: Array<{ id: string }>;
      settings: { keepHistory: boolean };
      retentionPolicy: { historyLengthDays: number };
    };

    expect(historyRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 500,
      }),
    );
    expect(payload.history).toEqual([
      expect.objectContaining({
        id: 'history-1',
      }),
    ]);
    expect(payload.settings.keepHistory).toBe(true);
    expect(payload.retentionPolicy.historyLengthDays).toBe(30);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'smart_reply_data_export_requested',
      }),
    );
  });

  it('exports smart reply settings/history payload for admin legal request', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'settings-2',
      userId: 'user-2',
      enabled: true,
      defaultTone: 'professional',
      defaultLength: 'medium',
      aiModel: 'balanced',
      includeSignature: true,
      personalization: 80,
      creativityLevel: 45,
      maxSuggestions: 3,
      customInstructions: 'Keep it concise',
      keepHistory: true,
      historyLength: 30,
    } as SmartReplySettings);
    historyRepo.find.mockResolvedValue([]);

    const result = await service.exportSmartReplyDataForAdmin({
      targetUserId: 'user-2',
      actorUserId: 'admin-1',
      limit: 250,
    });
    const parsedPayload: unknown = JSON.parse(result.dataJson);
    const payload = parsedPayload as {
      settings: { keepHistory: boolean };
      history: unknown[];
    };

    expect(payload.settings.keepHistory).toBe(true);
    expect(payload.history).toEqual([]);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        action: 'smart_reply_data_export_requested',
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'smart_reply_data_export_requested_by_admin',
        metadata: expect.objectContaining({
          targetUserId: 'user-2',
        }),
      }),
    );
  });

  it('does not fail admin smart reply export when admin audit write fails', async () => {
    settingsRepo.findOne.mockResolvedValue({
      id: 'settings-2',
      userId: 'user-2',
      enabled: true,
      defaultTone: 'professional',
      defaultLength: 'medium',
      aiModel: 'balanced',
      includeSignature: true,
      personalization: 80,
      creativityLevel: 45,
      maxSuggestions: 3,
      customInstructions: 'Keep it concise',
      keepHistory: true,
      historyLength: 30,
    } as SmartReplySettings);
    historyRepo.find.mockResolvedValue([]);
    auditLogRepo.save
      .mockResolvedValueOnce({} as AuditLog)
      .mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.exportSmartReplyDataForAdmin({
      targetUserId: 'user-2',
      actorUserId: 'admin-1',
      limit: 10,
    });

    expect(result.generatedAtIso).toBeTruthy();
    expect(result.dataJson).toContain('"settings"');
  });

  it('rejects admin smart reply export when actor user id is missing', async () => {
    await expect(
      service.exportSmartReplyDataForAdmin({
        targetUserId: 'user-2',
        actorUserId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not fail when audit log writes fail', async () => {
    historyRepo.delete.mockResolvedValue({ affected: 2 } as DeleteResult);
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await service.purgeHistory('user-1');

    expect(result.purgedRows).toBe(2);
    expect(historyRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('returns provider health summary snapshot', () => {
    providerRouter.getProviderHealthSnapshot.mockReturnValue({
      mode: 'openai',
      hybridPrimary: 'openai',
      providers: [
        {
          providerId: 'openai',
          enabled: true,
          configured: true,
          priority: 1,
        },
      ],
    });

    const result = service.getProviderHealthSummary();

    expect(providerRouter.getProviderHealthSnapshot).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        mode: 'openai',
        hybridPrimary: 'openai',
        providers: [
          expect.objectContaining({
            providerId: 'openai',
            priority: 1,
          }),
        ],
        executedAtIso: expect.any(String),
      }),
    );
  });
});
