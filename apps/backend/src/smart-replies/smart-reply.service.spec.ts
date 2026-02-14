import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { SmartReplyService } from './smart-reply.service';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';

describe('SmartReplyService', () => {
  let service: SmartReplyService;
  let settingsRepo: jest.Mocked<Repository<SmartReplySettings>>;

  beforeEach(async () => {
    const repoMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
    } as unknown as jest.Mocked<Repository<SmartReplySettings>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartReplyService,
        { provide: getRepositoryToken(SmartReplySettings), useValue: repoMock },
      ],
    }).compile();

    service = module.get<SmartReplyService>(SmartReplyService);
    settingsRepo = module.get(getRepositoryToken(SmartReplySettings));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('generates a non-empty reply string', async () => {
    const result = await service.generateReply({
      conversation: 'Can you confirm the timeline for delivery?',
    });

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
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
    const created = { id: 'settings-1', userId: 'user-1' } as SmartReplySettings;
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
});
