/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DeleteResult, Repository } from 'typeorm';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyHistory } from './entities/smart-reply-history.entity';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';

describe('SmartReplyService', () => {
  let service: SmartReplyService;
  let settingsRepo: jest.Mocked<Repository<SmartReplySettings>>;
  let historyRepo: jest.Mocked<Repository<SmartReplyHistory>>;
  let modelProvider: jest.Mocked<SmartReplyModelProvider>;
  let externalModelAdapter: jest.Mocked<SmartReplyExternalModelAdapter>;

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
    const modelProviderMock = {
      generateSuggestions: jest.fn(),
    } as unknown as jest.Mocked<SmartReplyModelProvider>;
    const externalModelAdapterMock = {
      generateSuggestions: jest.fn(),
    } as unknown as jest.Mocked<SmartReplyExternalModelAdapter>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartReplyService,
        { provide: getRepositoryToken(SmartReplySettings), useValue: repoMock },
        {
          provide: getRepositoryToken(SmartReplyHistory),
          useValue: historyRepoMock,
        },
        { provide: SmartReplyModelProvider, useValue: modelProviderMock },
        {
          provide: SmartReplyExternalModelAdapter,
          useValue: externalModelAdapterMock,
        },
      ],
    }).compile();

    service = module.get<SmartReplyService>(SmartReplyService);
    settingsRepo = module.get(getRepositoryToken(SmartReplySettings));
    historyRepo = module.get(getRepositoryToken(SmartReplyHistory));
    modelProvider = module.get(SmartReplyModelProvider);
    externalModelAdapter = module.get(SmartReplyExternalModelAdapter);
    historyRepo.create.mockImplementation(
      (value) => value as SmartReplyHistory,
    );
    historyRepo.save.mockImplementation((value) =>
      Promise.resolve(value as SmartReplyHistory),
    );
    historyRepo.delete.mockResolvedValue({ affected: 0 } as DeleteResult);
    historyRepo.find.mockResolvedValue([]);
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
    modelProvider.generateSuggestions.mockReturnValue([
      'Deterministic suggestion',
      'Alternative',
    ]);
    externalModelAdapter.generateSuggestions.mockResolvedValue([]);

    const result = await service.generateReply(
      {
        conversation: 'Can you confirm the timeline for delivery?',
      },
      'user-1',
    );

    expect(modelProvider.generateSuggestions).toHaveBeenCalled();
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

    expect(modelProvider.generateSuggestions).not.toHaveBeenCalled();
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
    modelProvider.generateSuggestions.mockReturnValue(['One', 'Two']);
    externalModelAdapter.generateSuggestions.mockResolvedValue([]);

    const result = await service.getSuggestedReplies(
      'Can we schedule a meeting?',
      5,
      'user-1',
    );

    expect(modelProvider.generateSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2 }),
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
    externalModelAdapter.generateSuggestions.mockResolvedValue([
      'External model suggestion',
    ]);

    const result = await service.generateReply(
      { conversation: 'Need update on proposal status.' },
      'user-1',
    );

    expect(externalModelAdapter.generateSuggestions).toHaveBeenCalled();
    expect(modelProvider.generateSuggestions).not.toHaveBeenCalled();
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
    modelProvider.generateSuggestions.mockReturnValue(['Reply one']);
    externalModelAdapter.generateSuggestions.mockResolvedValue([]);

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
  });
});
