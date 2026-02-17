import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { GmailSyncResolver } from './gmail-sync.resolver';

describe('GmailSyncResolver', () => {
  const gmailSyncService = {
    syncGmailProvider: jest.fn(),
    listInboxMessagesForProvider: jest.fn(),
  };
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  let resolver: GmailSyncResolver;

  beforeEach(() => {
    auditLogRepo = {
      create: jest.fn((payload: unknown) => payload as AuditLog),
      save: jest.fn().mockResolvedValue({} as AuditLog),
    } as unknown as jest.Mocked<Repository<AuditLog>>;
    resolver = new GmailSyncResolver(gmailSyncService as never, auditLogRepo);
    jest.clearAllMocks();
  });

  it('records success audit entry for sync mutation', async () => {
    gmailSyncService.syncGmailProvider.mockResolvedValue({ imported: 4 });

    const result = await resolver.syncGmailProvider(
      'provider-1',
      25,
      {
        req: {
          user: {
            id: 'user-1',
          },
        },
      } as never,
    );

    expect(result).toBe(true);
    expect(gmailSyncService.syncGmailProvider).toHaveBeenCalledWith(
      'provider-1',
      'user-1',
      25,
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'gmail_sync_requested',
      }),
    );
  });

  it('records failed audit entry when sync mutation fails', async () => {
    gmailSyncService.syncGmailProvider.mockRejectedValue(
      new Error('sync unavailable'),
    );

    await expect(
      resolver.syncGmailProvider(
        'provider-1',
        20,
        {
          req: {
            user: {
              id: 'user-1',
            },
          },
        } as never,
      ),
    ).rejects.toThrow('sync unavailable');

    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'gmail_sync_request_failed',
      }),
    );
  });

  it('continues successful sync flow when audit write fails', async () => {
    gmailSyncService.syncGmailProvider.mockResolvedValue({ imported: 1 });
    auditLogRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));

    const result = await resolver.syncGmailProvider(
      'provider-2',
      null as never,
      {
        req: {
          user: {
            id: 'user-2',
          },
        },
      } as never,
    );

    expect(result).toBe(true);
    expect(gmailSyncService.syncGmailProvider).toHaveBeenCalledWith(
      'provider-2',
      'user-2',
      25,
    );
  });
});
