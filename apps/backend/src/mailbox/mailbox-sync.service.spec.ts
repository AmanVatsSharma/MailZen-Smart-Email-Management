/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from 'axios';
import { Repository, UpdateResult } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { MailboxInboundService } from './mailbox-inbound.service';
import { MailboxSyncService } from './mailbox-sync.service';
import { Mailbox } from './entities/mailbox.entity';
import { MailboxSyncRun } from './entities/mailbox-sync-run.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { UserNotification } from '../notification/entities/user-notification.entity';

jest.mock('axios');

describe('MailboxSyncService', () => {
  const mailboxRepo: jest.Mocked<Repository<Mailbox>> = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
  } as unknown as jest.Mocked<Repository<Mailbox>>;
  const mailboxSyncRunRepo: jest.Mocked<Repository<MailboxSyncRun>> = {
    delete: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<MailboxSyncRun>>;
  const notificationRepo: jest.Mocked<Repository<UserNotification>> = {
    find: jest.fn(),
  } as unknown as jest.Mocked<Repository<UserNotification>>;
  const auditLogRepo: jest.Mocked<Repository<AuditLog>> = {
    create: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<AuditLog>>;
  const mailboxInboundServiceMock: jest.Mocked<
    Pick<MailboxInboundService, 'ingestInboundEvent'>
  > = {
    ingestInboundEvent: jest.fn(),
  };
  const notificationEventBusMock: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  > = {
    publishSafely: jest.fn(),
  };
  const originalEnv = process.env;
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  let service: MailboxSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.MAILZEN_MAIL_SYNC_API_URL = 'https://mail-sync.local';
    mailboxRepo.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    mailboxRepo.query.mockResolvedValue([{ id: 'mailbox-1' }] as never);
    mailboxRepo.find.mockResolvedValue([]);
    mailboxRepo.findOne.mockResolvedValue(null);
    mailboxSyncRunRepo.create.mockImplementation(
      (value) => value as MailboxSyncRun,
    );
    mailboxSyncRunRepo.save.mockResolvedValue({} as MailboxSyncRun);
    mailboxSyncRunRepo.delete.mockResolvedValue({ affected: 0 } as never);
    mailboxSyncRunRepo.find.mockResolvedValue([]);
    notificationRepo.find.mockResolvedValue([]);
    auditLogRepo.create.mockImplementation(
      (value: Partial<AuditLog>) => value as AuditLog,
    );
    auditLogRepo.save.mockResolvedValue({ id: 'audit-log-1' } as AuditLog);
    mailboxInboundServiceMock.ingestInboundEvent.mockResolvedValue({
      accepted: true,
      mailboxId: 'mailbox-1',
      mailboxEmail: 'sales@mailzen.com',
      emailId: 'email-1',
      deduplicated: false,
    });
    mockedAxios.isAxiosError.mockImplementation((value: unknown) =>
      Boolean((value as { isAxiosError?: boolean } | null)?.isAxiosError),
    );
    notificationEventBusMock.publishSafely.mockResolvedValue(null);
    service = new MailboxSyncService(
      mailboxRepo,
      mailboxSyncRunRepo,
      notificationRepo,
      auditLogRepo,
      mailboxInboundServiceMock as unknown as MailboxInboundService,
      notificationEventBusMock as unknown as NotificationEventBusService,
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('polls a mailbox, ingests messages, and persists next cursor', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        messages: [
          {
            from: 'lead@example.com',
            to: ['sales@mailzen.com'],
            subject: 'New lead',
            textBody: 'Hi there',
            messageId: '<msg-1@example.com>',
            sizeBytes: '200',
          },
        ],
        nextCursor: 'cursor-2',
      },
    } as never);

    const result = await service.pollMailbox({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
      userId: 'user-1',
      inboundSyncCursor: 'cursor-1',
    } as Mailbox);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://mail-sync.local/mailboxes/sales%40mailzen.com/messages',
      expect.objectContaining({
        params: expect.objectContaining({
          limit: 25,
          cursor: 'cursor-1',
        }),
      }),
    );
    expect(mailboxInboundServiceMock.ingestInboundEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxEmail: 'sales@mailzen.com',
        from: 'lead@example.com',
        messageId: '<msg-1@example.com>',
      }),
      expect.objectContaining({
        requestIdHeader: expect.stringMatching(/^mailbox-sync:mailbox-1:/),
      }),
      { skipAuth: true },
    );
    expect(mailboxRepo.update).toHaveBeenCalledWith(
      { id: 'mailbox-1' },
      expect.objectContaining({
        inboundSyncStatus: 'syncing',
      }),
    );
    expect(mailboxRepo.update).toHaveBeenCalledWith(
      { id: 'mailbox-1' },
      expect.objectContaining({
        inboundSyncCursor: 'cursor-2',
        inboundSyncStatus: 'connected',
        inboundSyncLastPolledAt: expect.any(Date),
        inboundSyncLastError: null,
        inboundSyncLastErrorAt: null,
      }),
    );
    expect(result).toEqual({
      mailboxId: 'mailbox-1',
      mailboxEmail: 'sales@mailzen.com',
      fetchedMessages: 1,
      acceptedMessages: 1,
      deduplicatedMessages: 0,
      rejectedMessages: 0,
      nextCursor: 'cursor-2',
    });
    expect(mailboxSyncRunRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        triggerSource: 'SCHEDULER',
        status: 'SUCCESS',
        fetchedMessages: 1,
        acceptedMessages: 1,
      }),
    );
  });

  it('tracks deduplicated mailbox inbound events', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        value: [
          {
            from: 'lead@example.com',
            subject: 'duplicate',
            textBody: 'Duplicate',
            messageId: '<msg-dup@example.com>',
          },
        ],
      },
    } as never);
    mailboxInboundServiceMock.ingestInboundEvent.mockResolvedValue({
      accepted: true,
      mailboxId: 'mailbox-1',
      mailboxEmail: 'sales@mailzen.com',
      emailId: 'email-1',
      deduplicated: true,
    });

    const result = await service.pollMailbox({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
      inboundSyncCursor: null,
    } as Mailbox);

    expect(result.acceptedMessages).toBe(0);
    expect(result.deduplicatedMessages).toBe(1);
    expect(result.rejectedMessages).toBe(0);
  });

  it('emits sync recovered event when mailbox had prior sync error', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        messages: [
          {
            from: 'lead@example.com',
            subject: 'Recovered message',
            textBody: 'Recovered body',
            messageId: '<recovered-1@example.com>',
          },
        ],
        nextCursor: 'cursor-recovered',
      },
    } as never);

    const result = await service.pollMailbox({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
      userId: 'user-1',
      inboundSyncStatus: 'error',
      inboundSyncLastError: 'previous outage',
    } as Mailbox);

    expect(result.acceptedMessages).toBe(1);
    expect(notificationEventBusMock.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SYNC_RECOVERED',
        metadata: expect.objectContaining({
          mailboxId: 'mailbox-1',
          providerType: 'MAILBOX',
        }),
      }),
    );
  });

  it('records mailbox sync error when pull fails', async () => {
    process.env.MAILZEN_MAIL_SYNC_RETRIES = '0';
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      message: 'gateway timeout',
      response: {
        status: 504,
      },
      code: 'ECONNABORTED',
    });

    await expect(
      service.pollMailbox({
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
        userId: 'user-1',
      } as Mailbox),
    ).rejects.toBeDefined();
    expect(mailboxRepo.update).toHaveBeenCalledWith(
      { id: 'mailbox-1' },
      expect.objectContaining({
        inboundSyncStatus: 'error',
        inboundSyncLastPolledAt: expect.any(Date),
        inboundSyncLastError: expect.stringContaining('status=504'),
        inboundSyncLastErrorAt: expect.any(Date),
      }),
    );
    expect(notificationEventBusMock.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SYNC_FAILED',
        metadata: expect.objectContaining({
          mailboxId: 'mailbox-1',
          providerType: 'MAILBOX',
        }),
      }),
    );
    expect(mailboxSyncRunRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        status: 'FAILED',
      }),
    );
  });

  it('retries mailbox pull when sync API returns retryable failure', async () => {
    process.env.MAILZEN_MAIL_SYNC_RETRIES = '2';
    process.env.MAILZEN_MAIL_SYNC_RETRY_BACKOFF_MS = '1';
    process.env.MAILZEN_MAIL_SYNC_RETRY_JITTER_MS = '0';
    mockedAxios.get
      .mockRejectedValueOnce({
        isAxiosError: true,
        message: 'temporary outage',
        response: {
          status: 503,
        },
      })
      .mockResolvedValueOnce({
        data: {
          messages: [
            {
              from: 'lead@example.com',
              subject: 'retry message',
              textBody: 'retry body',
              messageId: '<retry-1@example.com>',
            },
          ],
          nextCursor: 'cursor-3',
        },
      } as never);

    const result = await service.pollMailbox({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
      inboundSyncCursor: 'cursor-2',
    } as Mailbox);

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(result.acceptedMessages).toBe(1);
    expect(result.nextCursor).toBe('cursor-3');
  });

  it('does not retry mailbox pull when failure is non-retryable', async () => {
    process.env.MAILZEN_MAIL_SYNC_RETRIES = '3';
    process.env.MAILZEN_MAIL_SYNC_RETRY_BACKOFF_MS = '1';
    process.env.MAILZEN_MAIL_SYNC_RETRY_JITTER_MS = '0';
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      message: 'bad request',
      response: {
        status: 400,
      },
    });

    await expect(
      service.pollMailbox({
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
      } as Mailbox),
    ).rejects.toBeDefined();
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('suppresses duplicate mailbox sync failure notifications for same error', async () => {
    process.env.MAILZEN_MAIL_SYNC_RETRIES = '0';
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      message: 'gateway timeout',
      response: {
        status: 504,
      },
      code: 'ECONNABORTED',
    });

    await expect(
      service.pollMailbox({
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
        userId: 'user-1',
        inboundSyncLastError:
          'gateway timeout status=504 code=ECONNABORTED data=""',
      } as Mailbox),
    ).rejects.toBeDefined();

    expect(notificationEventBusMock.publishSafely).not.toHaveBeenCalled();
  });

  it('continues processing remaining messages when fail-fast disabled', async () => {
    process.env.MAILZEN_MAIL_SYNC_FAIL_FAST = 'false';
    mockedAxios.get.mockResolvedValue({
      data: {
        messages: [
          {
            from: 'broken@example.com',
            subject: 'broken',
            textBody: 'broken body',
            messageId: '<broken-1@example.com>',
          },
          {
            from: 'lead@example.com',
            subject: 'healthy',
            textBody: 'healthy body',
            messageId: '<healthy-1@example.com>',
          },
        ],
        nextCursor: 'cursor-after-errors',
      },
    } as never);
    mailboxInboundServiceMock.ingestInboundEvent
      .mockRejectedValueOnce(new Error('poison message'))
      .mockResolvedValueOnce({
        accepted: true,
        mailboxId: 'mailbox-1',
        mailboxEmail: 'sales@mailzen.com',
        emailId: 'email-healthy',
        deduplicated: false,
      });

    const result = await service.pollMailbox({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
      userId: 'user-1',
      inboundSyncCursor: 'cursor-before-errors',
    } as Mailbox);

    expect(mailboxInboundServiceMock.ingestInboundEvent).toHaveBeenCalledTimes(
      2,
    );
    expect(result).toEqual({
      mailboxId: 'mailbox-1',
      mailboxEmail: 'sales@mailzen.com',
      fetchedMessages: 2,
      acceptedMessages: 1,
      deduplicatedMessages: 0,
      rejectedMessages: 1,
      nextCursor: 'cursor-after-errors',
    });
    expect(mailboxRepo.update).toHaveBeenCalledWith(
      { id: 'mailbox-1' },
      expect.objectContaining({
        inboundSyncCursor: 'cursor-after-errors',
        inboundSyncStatus: 'connected',
        inboundSyncLastError: null,
        inboundSyncLastErrorAt: null,
      }),
    );
    expect(mailboxSyncRunRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        status: 'PARTIAL',
        rejectedMessages: 1,
      }),
    );
  });

  it('polls active mailboxes and continues after failures', async () => {
    mailboxRepo.find.mockResolvedValue([
      {
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
      } as Mailbox,
      {
        id: 'mailbox-2',
        email: 'ops@mailzen.com',
      } as Mailbox,
    ]);
    const pollMailboxSpy = jest
      .spyOn(service, 'pollMailbox')
      .mockResolvedValueOnce({
        mailboxId: 'mailbox-1',
        mailboxEmail: 'sales@mailzen.com',
        fetchedMessages: 2,
        acceptedMessages: 2,
        deduplicatedMessages: 0,
        rejectedMessages: 0,
        nextCursor: 'cursor-a',
      })
      .mockRejectedValueOnce(new Error('mailbox down'));

    const result = await service.pollActiveMailboxes();

    expect(pollMailboxSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      polledMailboxes: 2,
      skippedMailboxes: 0,
      failedMailboxes: 1,
      fetchedMessages: 2,
      acceptedMessages: 2,
      deduplicatedMessages: 0,
      rejectedMessages: 0,
    });
  });

  it('skips mailbox poll when lease is already held by another worker', async () => {
    mailboxRepo.find.mockResolvedValue([
      {
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
        userId: 'user-1',
      } as Mailbox,
    ]);
    mailboxRepo.query.mockResolvedValueOnce([]);
    const pollMailboxSpy = jest.spyOn(service, 'pollMailbox');

    const result = await service.pollActiveMailboxes();

    expect(pollMailboxSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      polledMailboxes: 1,
      skippedMailboxes: 1,
      failedMailboxes: 0,
      fetchedMessages: 0,
      acceptedMessages: 0,
      deduplicatedMessages: 0,
      rejectedMessages: 0,
    });
    expect(mailboxSyncRunRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        status: 'SKIPPED',
        triggerSource: 'SCHEDULER',
      }),
    );
  });

  it('lists mailbox sync states scoped to current user', async () => {
    mailboxRepo.find.mockResolvedValue([
      {
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
        workspaceId: 'workspace-1',
        inboundSyncCursor: 'cursor-1',
        inboundSyncStatus: 'connected',
        inboundSyncLastPolledAt: new Date('2026-02-16T00:00:00.000Z'),
        inboundSyncLastError: null,
        inboundSyncLastErrorAt: null,
        inboundSyncLeaseExpiresAt: null,
      } as Mailbox,
    ]);

    const states = await service.listMailboxSyncStatesForUser({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    expect(mailboxRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', workspaceId: 'workspace-1' },
      }),
    );
    expect(states).toEqual([
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        mailboxEmail: 'sales@mailzen.com',
        inboundSyncCursor: 'cursor-1',
        inboundSyncStatus: 'connected',
      }),
    ]);
  });

  it('returns mailbox sync run history for user observability', async () => {
    const startedAt = new Date('2026-02-16T00:00:00.000Z');
    const completedAt = new Date('2026-02-16T00:00:05.000Z');
    mailboxSyncRunRepo.find.mockResolvedValue([
      {
        id: 'run-1',
        mailboxId: 'mailbox-1',
        workspaceId: 'workspace-1',
        triggerSource: 'manual',
        runCorrelationId: 'corr-1',
        status: 'partial',
        fetchedMessages: 5,
        acceptedMessages: 4,
        deduplicatedMessages: 1,
        rejectedMessages: 1,
        nextCursor: 'cursor-5',
        errorMessage: null,
        startedAt,
        completedAt,
        durationMs: 5000,
      } as MailboxSyncRun,
    ]);
    mailboxRepo.find.mockResolvedValue([
      {
        id: 'mailbox-1',
        email: 'sales@mailzen.com',
      } as Mailbox,
    ]);

    const runs = await service.getMailboxSyncRunsForUser({
      userId: 'user-1',
      windowHours: 24,
      limit: 10,
    });

    expect(runs).toEqual([
      expect.objectContaining({
        id: 'run-1',
        mailboxId: 'mailbox-1',
        mailboxEmail: 'sales@mailzen.com',
        triggerSource: 'MANUAL',
        status: 'PARTIAL',
      }),
    ]);
  });

  it('returns mailbox sync run stats for user observability', async () => {
    mailboxSyncRunRepo.find.mockResolvedValue([
      {
        id: 'run-1',
        mailboxId: 'mailbox-1',
        triggerSource: 'SCHEDULER',
        status: 'SUCCESS',
        fetchedMessages: 3,
        acceptedMessages: 3,
        deduplicatedMessages: 0,
        rejectedMessages: 0,
        durationMs: 100,
        completedAt: new Date('2026-02-16T01:00:00.000Z'),
      } as MailboxSyncRun,
      {
        id: 'run-2',
        mailboxId: 'mailbox-1',
        triggerSource: 'MANUAL',
        status: 'FAILED',
        fetchedMessages: 2,
        acceptedMessages: 1,
        deduplicatedMessages: 0,
        rejectedMessages: 1,
        durationMs: 200,
        completedAt: new Date('2026-02-16T00:30:00.000Z'),
      } as MailboxSyncRun,
    ]);

    const stats = await service.getMailboxSyncRunStatsForUser({
      userId: 'user-1',
      windowHours: 24,
    });

    expect(stats.totalRuns).toBe(2);
    expect(stats.successRuns).toBe(1);
    expect(stats.failedRuns).toBe(1);
    expect(stats.schedulerRuns).toBe(1);
    expect(stats.manualRuns).toBe(1);
    expect(stats.fetchedMessages).toBe(5);
    expect(stats.acceptedMessages).toBe(4);
    expect(stats.rejectedMessages).toBe(1);
  });

  it('returns mailbox sync run series for user observability', async () => {
    mailboxSyncRunRepo.find.mockResolvedValue([
      {
        id: 'run-1',
        mailboxId: 'mailbox-1',
        status: 'SUCCESS',
        fetchedMessages: 3,
        acceptedMessages: 3,
        deduplicatedMessages: 0,
        rejectedMessages: 0,
        completedAt: new Date(),
      } as MailboxSyncRun,
    ]);

    const series = await service.getMailboxSyncRunSeriesForUser({
      userId: 'user-1',
      windowHours: 1,
      bucketMinutes: 60,
    });

    const populated = series.find((point) => point.totalRuns > 0);
    expect(populated).toBeDefined();
    expect(populated?.successRuns).toBe(1);
    expect(populated?.fetchedMessages).toBe(3);
  });

  it('exports mailbox sync observability payload', async () => {
    const statsSpy = jest
      .spyOn(service, 'getMailboxSyncRunStatsForUser')
      .mockResolvedValue({
        mailboxId: 'mailbox-1',
        workspaceId: 'workspace-1',
        windowHours: 24,
        totalRuns: 1,
        successRuns: 1,
        partialRuns: 0,
        failedRuns: 0,
        skippedRuns: 0,
        schedulerRuns: 1,
        manualRuns: 0,
        fetchedMessages: 2,
        acceptedMessages: 2,
        deduplicatedMessages: 0,
        rejectedMessages: 0,
        avgDurationMs: 50,
        latestCompletedAtIso: '2026-02-16T00:00:00.000Z',
      });
    const seriesSpy = jest
      .spyOn(service, 'getMailboxSyncRunSeriesForUser')
      .mockResolvedValue([
        {
          bucketStart: new Date('2026-02-16T00:00:00.000Z'),
          totalRuns: 1,
          successRuns: 1,
          partialRuns: 0,
          failedRuns: 0,
          skippedRuns: 0,
          fetchedMessages: 2,
          acceptedMessages: 2,
          deduplicatedMessages: 0,
          rejectedMessages: 0,
        },
      ]);
    const runsSpy = jest
      .spyOn(service, 'getMailboxSyncRunsForUser')
      .mockResolvedValue([
        {
          id: 'run-1',
          mailboxId: 'mailbox-1',
          mailboxEmail: 'sales@mailzen.com',
          workspaceId: 'workspace-1',
          triggerSource: 'SCHEDULER',
          runCorrelationId: 'corr-1',
          status: 'SUCCESS',
          fetchedMessages: 2,
          acceptedMessages: 2,
          deduplicatedMessages: 0,
          rejectedMessages: 0,
          nextCursor: null,
          errorMessage: null,
          startedAt: new Date('2026-02-16T00:00:00.000Z'),
          completedAt: new Date('2026-02-16T00:00:01.000Z'),
          durationMs: 1000,
        },
      ]);

    const exported = await service.exportMailboxSyncDataForUser({
      userId: 'user-1',
      mailboxId: 'mailbox-1',
      workspaceId: 'workspace-1',
      limit: 25,
      windowHours: 24,
      bucketMinutes: 60,
    });

    expect(statsSpy).toHaveBeenCalledTimes(1);
    expect(seriesSpy).toHaveBeenCalledTimes(1);
    expect(runsSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(exported.dataJson) as {
      stats: { totalRuns: number };
      series: Array<{ totalRuns: number }>;
      runs: Array<{ id: string }>;
    };
    expect(payload.stats.totalRuns).toBe(1);
    expect(payload.series[0]?.totalRuns).toBe(1);
    expect(payload.runs[0]?.id).toBe('run-1');
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'mailbox_sync_data_export_requested',
      }),
    );
  });

  it('returns mailbox sync incident stats for user', async () => {
    mailboxSyncRunRepo.find
      .mockResolvedValueOnce([
        {
          id: 'run-1',
          mailboxId: 'mailbox-1',
          triggerSource: 'SCHEDULER',
          status: 'SUCCESS',
          fetchedMessages: 3,
          acceptedMessages: 3,
          deduplicatedMessages: 0,
          rejectedMessages: 0,
          durationMs: 100,
          completedAt: new Date('2026-02-16T01:00:00.000Z'),
        } as MailboxSyncRun,
        {
          id: 'run-2',
          mailboxId: 'mailbox-1',
          triggerSource: 'SCHEDULER',
          status: 'FAILED',
          fetchedMessages: 2,
          acceptedMessages: 1,
          deduplicatedMessages: 0,
          rejectedMessages: 1,
          durationMs: 120,
          completedAt: new Date('2026-02-16T00:30:00.000Z'),
        } as MailboxSyncRun,
      ])
      .mockResolvedValueOnce([
        {
          id: 'run-2',
          mailboxId: 'mailbox-1',
          status: 'FAILED',
          completedAt: new Date('2026-02-16T00:30:00.000Z'),
        } as MailboxSyncRun,
      ]);

    const stats = await service.getMailboxSyncIncidentStatsForUser({
      userId: 'user-1',
      windowHours: 24,
    });

    expect(stats.totalRuns).toBe(2);
    expect(stats.incidentRuns).toBe(1);
    expect(stats.failedRuns).toBe(1);
    expect(stats.partialRuns).toBe(0);
    expect(stats.incidentRatePercent).toBe(50);
    expect(stats.lastIncidentAtIso).toBe('2026-02-16T00:30:00.000Z');
  });

  it('returns mailbox sync incident series for user', async () => {
    mailboxSyncRunRepo.find.mockResolvedValue([
      {
        id: 'run-1',
        mailboxId: 'mailbox-1',
        status: 'FAILED',
        fetchedMessages: 2,
        acceptedMessages: 1,
        deduplicatedMessages: 0,
        rejectedMessages: 1,
        completedAt: new Date(),
      } as MailboxSyncRun,
    ]);

    const series = await service.getMailboxSyncIncidentSeriesForUser({
      userId: 'user-1',
      windowHours: 1,
      bucketMinutes: 60,
    });

    const populated = series.find((point) => point.totalRuns > 0);
    expect(populated).toBeDefined();
    expect(populated?.incidentRuns).toBe(1);
    expect(populated?.failedRuns).toBe(1);
  });

  it('exports mailbox sync incident analytics payload', async () => {
    const incidentStatsSpy = jest
      .spyOn(service, 'getMailboxSyncIncidentStatsForUser')
      .mockResolvedValue({
        mailboxId: 'mailbox-1',
        workspaceId: 'workspace-1',
        windowHours: 24,
        totalRuns: 5,
        incidentRuns: 2,
        failedRuns: 1,
        partialRuns: 1,
        incidentRatePercent: 40,
        lastIncidentAtIso: '2026-02-16T00:30:00.000Z',
      });
    const incidentSeriesSpy = jest
      .spyOn(service, 'getMailboxSyncIncidentSeriesForUser')
      .mockResolvedValue([
        {
          bucketStart: new Date('2026-02-16T00:00:00.000Z'),
          totalRuns: 3,
          incidentRuns: 1,
          failedRuns: 1,
          partialRuns: 0,
        },
      ]);

    const exported = await service.exportMailboxSyncIncidentDataForUser({
      userId: 'user-1',
      mailboxId: 'mailbox-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      bucketMinutes: 60,
    });

    expect(incidentStatsSpy).toHaveBeenCalledTimes(1);
    expect(incidentSeriesSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(exported.dataJson) as {
      stats: { incidentRuns: number };
      series: Array<{ incidentRuns: number }>;
    };
    expect(payload.stats.incidentRuns).toBe(2);
    expect(payload.series[0]?.incidentRuns).toBe(1);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'mailbox_sync_incident_data_export_requested',
      }),
    );
  });

  it('returns mailbox sync incident alert delivery stats', async () => {
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'user-1',
        type: 'MAILBOX_SYNC_INCIDENT_ALERT',
        metadata: {
          incidentStatus: 'WARNING',
        },
        createdAt: new Date('2026-02-16T00:10:00.000Z'),
      } as unknown as UserNotification,
      {
        id: 'notif-2',
        userId: 'user-1',
        type: 'MAILBOX_SYNC_INCIDENT_ALERT',
        metadata: {
          incidentStatus: 'CRITICAL',
        },
        createdAt: new Date('2026-02-16T00:20:00.000Z'),
      } as unknown as UserNotification,
    ]);

    const stats = await service.getMailboxSyncIncidentAlertDeliveryStatsForUser(
      {
        userId: 'user-1',
        windowHours: 24,
      },
    );

    expect(stats.totalCount).toBe(2);
    expect(stats.warningCount).toBe(1);
    expect(stats.criticalCount).toBe(1);
    expect(stats.lastAlertAtIso).toBe('2026-02-16T00:10:00.000Z');
  });

  it('returns mailbox sync incident alert history rows', async () => {
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'user-1',
        workspaceId: 'workspace-1',
        type: 'MAILBOX_SYNC_INCIDENT_ALERT',
        title: 'Mailbox sync incidents warning',
        message: 'incident warning',
        metadata: {
          incidentStatus: 'WARNING',
          incidentRatePercent: 12,
          incidentRuns: 2,
          totalRuns: 10,
          warningRatePercent: 10,
          criticalRatePercent: 25,
        },
        createdAt: new Date('2026-02-16T00:15:00.000Z'),
      } as unknown as UserNotification,
    ]);

    const rows = await service.getMailboxSyncIncidentAlertsForUser({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      windowHours: 24,
      limit: 50,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        notificationId: 'notif-1',
        status: 'WARNING',
        incidentRuns: 2,
        totalRuns: 10,
      }),
    ]);
  });

  it('exports mailbox sync incident alert history payload', async () => {
    const alertsSpy = jest
      .spyOn(service, 'getMailboxSyncIncidentAlertsForUser')
      .mockResolvedValue([
        {
          notificationId: 'notif-1',
          workspaceId: 'workspace-1',
          status: 'WARNING',
          title: 'Mailbox sync incidents warning',
          message: 'incident warning',
          incidentRatePercent: 12,
          incidentRuns: 2,
          totalRuns: 10,
          warningRatePercent: 10,
          criticalRatePercent: 25,
          createdAt: new Date('2026-02-16T00:15:00.000Z'),
        },
      ]);

    const exported =
      await service.exportMailboxSyncIncidentAlertHistoryDataForUser({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        windowHours: 24,
        limit: 25,
      });

    expect(alertsSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(exported.dataJson) as {
      alertCount: number;
      alerts: Array<{ notificationId: string }>;
    };
    expect(payload.alertCount).toBe(1);
    expect(payload.alerts[0]?.notificationId).toBe('notif-1');
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'mailbox_sync_incident_alert_history_export_requested',
      }),
    );
  });

  it('returns mailbox sync incident alert delivery series', async () => {
    notificationRepo.find.mockResolvedValue([
      {
        id: 'notif-1',
        userId: 'user-1',
        type: 'MAILBOX_SYNC_INCIDENT_ALERT',
        metadata: {
          incidentStatus: 'CRITICAL',
        },
        createdAt: new Date(),
      } as unknown as UserNotification,
    ]);

    const series =
      await service.getMailboxSyncIncidentAlertDeliverySeriesForUser({
        userId: 'user-1',
        windowHours: 1,
        bucketMinutes: 60,
      });

    const populated = series.find((point) => point.totalCount > 0);
    expect(populated).toBeDefined();
    expect(populated?.criticalCount).toBe(1);
  });

  it('exports mailbox sync incident alert delivery payload', async () => {
    const statsSpy = jest
      .spyOn(service, 'getMailboxSyncIncidentAlertDeliveryStatsForUser')
      .mockResolvedValue({
        workspaceId: 'workspace-1',
        windowHours: 24,
        totalCount: 2,
        warningCount: 1,
        criticalCount: 1,
        lastAlertAtIso: '2026-02-16T00:20:00.000Z',
      });
    const seriesSpy = jest
      .spyOn(service, 'getMailboxSyncIncidentAlertDeliverySeriesForUser')
      .mockResolvedValue([
        {
          bucketStart: new Date('2026-02-16T00:00:00.000Z'),
          totalCount: 2,
          warningCount: 1,
          criticalCount: 1,
        },
      ]);

    const exported =
      await service.exportMailboxSyncIncidentAlertDeliveryDataForUser({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        windowHours: 24,
        bucketMinutes: 60,
      });

    expect(statsSpy).toHaveBeenCalledTimes(1);
    expect(seriesSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(exported.dataJson) as {
      stats: { totalCount: number };
      series: Array<{ totalCount: number }>;
    };
    expect(payload.stats.totalCount).toBe(2);
    expect(payload.series[0]?.totalCount).toBe(2);
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'mailbox_sync_incident_alert_delivery_export_requested',
      }),
    );
  });

  it('purges mailbox sync run retention rows for a scoped user', async () => {
    mailboxSyncRunRepo.delete.mockResolvedValue({ affected: 4 } as never);

    const result = await service.purgeMailboxSyncRunRetentionData({
      userId: 'user-1',
      retentionDays: 30,
    });

    const deleteCriteria = mailboxSyncRunRepo.delete.mock.calls[0]?.[0] as
      | { userId?: string; completedAt?: unknown }
      | undefined;
    expect(deleteCriteria?.userId).toBe('user-1');
    expect(deleteCriteria?.completedAt).toBeDefined();
    expect(result).toEqual(
      expect.objectContaining({
        deletedRuns: 4,
        retentionDays: 30,
      }),
    );
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'mailbox_sync_run_retention_purged',
      }),
    );
  });

  it('does not fail retention purge when audit log write fails', async () => {
    mailboxSyncRunRepo.delete.mockResolvedValue({ affected: 2 } as never);
    auditLogRepo.save.mockRejectedValue(
      new Error('audit datastore unavailable'),
    );

    await expect(
      service.purgeMailboxSyncRunRetentionData({
        userId: 'user-1',
        retentionDays: 15,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        deletedRuns: 2,
        retentionDays: 15,
      }),
    );
  });

  it('runs mailbox poll for explicit mailbox id', async () => {
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      email: 'sales@mailzen.com',
      status: 'ACTIVE',
    } as Mailbox);
    mockedAxios.get.mockResolvedValue({
      data: {
        messages: [
          {
            from: 'lead@example.com',
            subject: 'manual poll',
            textBody: 'hello',
            messageId: '<manual-1@example.com>',
          },
        ],
        nextCursor: 'cursor-manual',
      },
    } as never);

    const result = await service.pollUserMailboxes({
      userId: 'user-1',
      mailboxId: 'mailbox-1',
      workspaceId: null,
    });

    expect(result).toEqual({
      polledMailboxes: 1,
      skippedMailboxes: 0,
      failedMailboxes: 0,
      fetchedMessages: 1,
      acceptedMessages: 1,
      deduplicatedMessages: 0,
      rejectedMessages: 0,
    });
    expect(auditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'mailbox_sync_manual_poll_requested',
      }),
    );
  });

  it('throws when explicit mailbox id is not owned by user', async () => {
    mailboxRepo.findOne.mockResolvedValue(null);

    await expect(
      service.pollUserMailboxes({
        userId: 'user-1',
        mailboxId: 'missing-mailbox',
      }),
    ).rejects.toThrow('Mailbox not found');
  });
});
