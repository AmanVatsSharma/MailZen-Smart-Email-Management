/* eslint-disable @typescript-eslint/unbound-method */
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';

describe('SmartReplyService', () => {
  let service: SmartReplyService;
  let settingsRepo: jest.Mocked<Repository<SmartReplySettings>>;
  let modelProvider: jest.Mocked<SmartReplyModelProvider>;
  let externalModelAdapter: jest.Mocked<SmartReplyExternalModelAdapter>;

  beforeEach(async () => {
    const repoMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
    } as unknown as jest.Mocked<Repository<SmartReplySettings>>;
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
        { provide: SmartReplyModelProvider, useValue: modelProviderMock },
        {
          provide: SmartReplyExternalModelAdapter,
          useValue: externalModelAdapterMock,
        },
      ],
    }).compile();

    service = module.get<SmartReplyService>(SmartReplyService);
    settingsRepo = module.get(getRepositoryToken(SmartReplySettings));
    modelProvider = module.get(SmartReplyModelProvider);
    externalModelAdapter = module.get(SmartReplyExternalModelAdapter);
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
  });
});
