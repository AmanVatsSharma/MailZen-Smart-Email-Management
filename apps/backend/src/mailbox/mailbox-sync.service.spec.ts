/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from 'axios';
import { Repository, UpdateResult } from 'typeorm';
import { MailboxInboundService } from './mailbox-inbound.service';
import { MailboxSyncService } from './mailbox-sync.service';
import { Mailbox } from './entities/mailbox.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';

jest.mock('axios');

describe('MailboxSyncService', () => {
  const mailboxRepo: jest.Mocked<Repository<Mailbox>> = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
  } as unknown as jest.Mocked<Repository<Mailbox>>;
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
