/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { MailboxResolver } from './mailbox.resolver';
import { MailboxService } from './mailbox.service';

describe('MailboxResolver', () => {
  let resolver: MailboxResolver;
  const mailboxServiceMock = {
    createMailbox: jest.fn(),
    getUserMailboxes: jest.fn(),
    getInboundEvents: jest.fn(),
    getInboundEventStats: jest.fn(),
    getInboundEventSeries: jest.fn(),
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

  it('forwards mailbox inbound event filters to service', async () => {
    mailboxServiceMock.getInboundEvents.mockResolvedValue([
      { id: 'event-1', mailboxId: 'mailbox-1', status: 'ACCEPTED' },
    ]);

    const result = await resolver.myMailboxInboundEvents(
      ctx as any,
      'mailbox-1',
      'ACCEPTED',
      25,
    );

    expect(mailboxServiceMock.getInboundEvents).toHaveBeenCalledWith('user-1', {
      mailboxId: 'mailbox-1',
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
      24,
    );

    expect(mailboxServiceMock.getInboundEventStats).toHaveBeenCalledWith(
      'user-1',
      {
        mailboxId: 'mailbox-1',
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
      24,
      60,
    );

    expect(mailboxServiceMock.getInboundEventSeries).toHaveBeenCalledWith(
      'user-1',
      {
        mailboxId: 'mailbox-1',
        windowHours: 24,
        bucketMinutes: 60,
      },
    );
    expect(result).toHaveLength(1);
    expect(result[0].totalCount).toBe(3);
  });
});
