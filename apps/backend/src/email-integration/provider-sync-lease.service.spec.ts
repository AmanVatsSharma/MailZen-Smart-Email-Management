import { Repository } from 'typeorm';
import { EmailProvider } from './entities/email-provider.entity';
import { ProviderSyncLeaseService } from './provider-sync-lease.service';

describe('ProviderSyncLeaseService', () => {
  type MockQueryBuilder = {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };

  let providerRepo: jest.Mocked<Repository<EmailProvider>>;
  let queryBuilder: MockQueryBuilder;
  let service: ProviderSyncLeaseService;

  beforeEach(() => {
    queryBuilder = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute: jest.fn(),
    };
    queryBuilder.update.mockReturnValue(queryBuilder);
    queryBuilder.set.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);

    providerRepo = {
      createQueryBuilder: jest.fn(() => queryBuilder),
    } as unknown as jest.Mocked<Repository<EmailProvider>>;
    service = new ProviderSyncLeaseService(providerRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('acquires lease when update affects one row', async () => {
    queryBuilder.execute.mockResolvedValue({ affected: 1 });

    const acquired = await service.acquireProviderSyncLease({
      providerId: 'provider-1',
      providerType: 'GMAIL',
      leaseTtlMs: 120_000,
    });

    expect(acquired).toBe(true);
    expect(queryBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'syncing',
        syncLeaseExpiresAt: expect.any(Date),
      }),
    );
  });

  it('returns false when lease already held', async () => {
    queryBuilder.execute.mockResolvedValue({ affected: 0 });

    const acquired = await service.acquireProviderSyncLease({
      providerId: 'provider-1',
      providerType: 'OUTLOOK',
    });

    expect(acquired).toBe(false);
  });

  it('returns false when query execution fails', async () => {
    queryBuilder.execute.mockRejectedValue(new Error('db unavailable'));

    const acquired = await service.acquireProviderSyncLease({
      providerId: 'provider-1',
      providerType: 'GMAIL',
    });

    expect(acquired).toBe(false);
  });
});
