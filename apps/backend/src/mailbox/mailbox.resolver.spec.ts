/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MailboxResolver } from './mailbox.resolver';
import { MailboxService } from './mailbox.service';
import { MailboxSyncService } from './mailbox-sync.service';

describe('MailboxResolver', () => {
  let resolver: MailboxResolver;
  const mailboxServiceMock = {
    createMailbox: jest.fn(),
    getUserMailboxes: jest.fn(),
    getInboundEvents: jest.fn(),
    getInboundEventStats: jest.fn(),
    getInboundEventSeries: jest.fn(),
    exportInboundEventData: jest.fn(),
    purgeInboundEventRetentionData: jest.fn(),
    getProvisioningHealthSummary: jest.fn(),
  };
  const mailboxSyncServiceMock = {
    listMailboxSyncStatesForUser: jest.fn(),
    pollUserMailboxes: jest.fn(),
  };

  const ctx = {
    req: {
      user: {
        id: 'user-1',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new MailboxResolver(
      mailboxServiceMock as unknown as MailboxService,
      mailboxSyncServiceMock as unknown as MailboxSyncService,
    );
  });

  it('delegates mailbox creation to service', async () => {
    mailboxServiceMock.createMailbox.mockResolvedValue({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
    });

    const result = await resolver.createMyMailbox(ctx as any, 'sales');

    expect(mailboxServiceMock.createMailbox).toHaveBeenCalledWith(
      'user-1',
      'sales',
    );
    expect(result).toBe('sales@mailzen.com');
  });

  it('returns mailbox email addresses for current user', async () => {
    mailboxServiceMock.getUserMailboxes.mockResolvedValue([
      { id: 'mailbox-1', email: 'sales@mailzen.com' },
      { id: 'mailbox-2', email: 'ops@mailzen.com' },
    ]);

    const result = await resolver.myMailboxes('workspace-1', ctx as any);

    expect(mailboxServiceMock.getUserMailboxes).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );
    expect(result).toEqual(['sales@mailzen.com', 'ops@mailzen.com']);
  });

  it('returns mailbox provisioning health summary for current user', () => {
    mailboxServiceMock.getProvisioningHealthSummary.mockReturnValue({
      provider: 'GENERIC',
      provisioningRequired: true,
      adminApiConfigured: true,
      configuredEndpointCount: 2,
      configuredEndpoints: [
        'https://mail-admin-a.local',
        'https://mail-admin-b.local',
      ],
      failoverEnabled: true,
      requestTimeoutMs: 5000,
      maxRetries: 2,
      retryBackoffMs: 300,
      retryJitterMs: 150,
      mailcowQuotaDefaultMb: 51200,
      evaluatedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = resolver.myMailboxProvisioningHealth();

    expect(
      mailboxServiceMock.getProvisioningHealthSummary,
    ).toHaveBeenCalledTimes(1);
    expect(result.failoverEnabled).toBe(true);
    expect(result.configuredEndpointCount).toBe(2);
  });

  it('forwards mailbox inbound event filters to service', async () => {
    mailboxServiceMock.getInboundEvents.mockResolvedValue([
      { id: 'event-1', mailboxId: 'mailbox-1', status: 'ACCEPTED' },
    ]);

    const result = await resolver.myMailboxInboundEvents(
      ctx as any,
      'mailbox-1',
      'workspace-1',
      'ACCEPTED',
      25,
    );

    expect(mailboxServiceMock.getInboundEvents).toHaveBeenCalledWith('user-1', {
      mailboxId: 'mailbox-1',
      workspaceId: 'workspace-1',
      status: 'ACCEPTED',
      limit: 25,
    });
    expect(result).toEqual([
      { id: 'event-1', mailboxId: 'mailbox-1', status: 'ACCEPTED' },
    ]);
  });

  it('forwards mailbox inbound stats query to service', async () => {
    mailboxServiceMock.getInboundEventStats.mockResolvedValue({
      mailboxId: 'mailbox-1',
      mailboxEmail: 'sales@mailzen.com',
      windowHours: 24,
      totalCount: 8,
      acceptedCount: 5,
      deduplicatedCount: 2,
      rejectedCount: 1,
      lastProcessedAt: '2026-02-15T13:00:00.000Z',
    });

    const result = await resolver.myMailboxInboundEventStats(
      ctx as any,
      'mailbox-1',
      'workspace-1',
      24,
    );

    expect(mailboxServiceMock.getInboundEventStats).toHaveBeenCalledWith(
      'user-1',
      {
        mailboxId: 'mailbox-1',
        workspaceId: 'workspace-1',
        windowHours: 24,
      },
    );
    expect(result.totalCount).toBe(8);
    expect(result.acceptedCount).toBe(5);
  });

  it('forwards mailbox inbound trend series query to service', async () => {
    mailboxServiceMock.getInboundEventSeries.mockResolvedValue([
      {
        bucketStart: '2026-02-15T12:00:00.000Z',
        totalCount: 3,
        acceptedCount: 2,
        deduplicatedCount: 1,
        rejectedCount: 0,
      },
    ]);

    const result = await resolver.myMailboxInboundEventSeries(
      ctx as any,
      'mailbox-1',
      'workspace-1',
      24,
      60,
    );

    expect(mailboxServiceMock.getInboundEventSeries).toHaveBeenCalledWith(
      'user-1',
      {
        mailboxId: 'mailbox-1',
        workspaceId: 'workspace-1',
        windowHours: 24,
        bucketMinutes: 60,
      },
    );
    expect(result).toHaveLength(1);
    expect(result[0].totalCount).toBe(3);
  });

  it('forwards mailbox inbound export query to service', async () => {
    mailboxServiceMock.exportInboundEventData.mockResolvedValue({
      generatedAtIso: '2026-02-16T00:00:00.000Z',
      dataJson: '{"events":[]}',
    });

    const result = await resolver.myMailboxInboundDataExport(
      ctx as any,
      'mailbox-1',
      'workspace-1',
      50,
      24,
      60,
    );

    expect(mailboxServiceMock.exportInboundEventData).toHaveBeenCalledWith({
      userId: 'user-1',
      mailboxId: 'mailbox-1',
      workspaceId: 'workspace-1',
      limit: 50,
      windowHours: 24,
      bucketMinutes: 60,
    });
    expect(result.generatedAtIso).toBe('2026-02-16T00:00:00.000Z');
  });

  it('forwards mailbox inbound retention purge mutation to service', async () => {
    mailboxServiceMock.purgeInboundEventRetentionData.mockResolvedValue({
      deletedEvents: 12,
      retentionDays: 180,
      executedAtIso: '2026-02-16T00:00:00.000Z',
    });

    const result = await resolver.purgeMyMailboxInboundRetentionData(
      ctx as any,
      180,
    );

    expect(
      mailboxServiceMock.purgeInboundEventRetentionData,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      retentionDays: 180,
    });
    expect(result.deletedEvents).toBe(12);
  });

  it('returns mailbox sync states for current user', async () => {
    mailboxSyncServiceMock.listMailboxSyncStatesForUser.mockResolvedValue([
      {
        mailboxId: 'mailbox-1',
        mailboxEmail: 'sales@mailzen.com',
        workspaceId: 'workspace-1',
        inboundSyncCursor: 'cursor-1',
        inboundSyncLastPolledAt: new Date('2026-02-16T00:00:00.000Z'),
        inboundSyncLastError: null,
        inboundSyncLeaseExpiresAt: null,
      },
    ]);

    await expect(
      resolver.myMailboxSyncStates(ctx as any, 'workspace-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        mailboxId: 'mailbox-1',
      }),
    ]);
    expect(
      mailboxSyncServiceMock.listMailboxSyncStatesForUser,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });
  });

  it('triggers mailbox pull sync for current user', async () => {
    mailboxSyncServiceMock.pollUserMailboxes.mockResolvedValue({
      polledMailboxes: 1,
      skippedMailboxes: 0,
      failedMailboxes: 0,
      fetchedMessages: 4,
      acceptedMessages: 3,
      deduplicatedMessages: 1,
      rejectedMessages: 0,
    });

    await expect(
      resolver.syncMyMailboxPull(ctx as any, 'mailbox-1', 'workspace-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        polledMailboxes: 1,
        acceptedMessages: 3,
        executedAtIso: expect.any(String),
      }),
    );
    expect(mailboxSyncServiceMock.pollUserMailboxes).toHaveBeenCalledWith({
      userId: 'user-1',
      mailboxId: 'mailbox-1',
      workspaceId: 'workspace-1',
    });
  });
});
