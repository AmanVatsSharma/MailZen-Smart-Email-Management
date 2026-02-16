/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from 'axios';
import { Repository, UpdateResult } from 'typeorm';
import { MailboxInboundService } from './mailbox-inbound.service';
import { MailboxSyncService } from './mailbox-sync.service';
import { Mailbox } from './entities/mailbox.entity';

jest.mock('axios');

describe('MailboxSyncService', () => {
  const mailboxRepo: jest.Mocked<Repository<Mailbox>> = {
    find: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
  } as unknown as jest.Mocked<Repository<Mailbox>>;
  const mailboxInboundServiceMock: jest.Mocked<
    Pick<MailboxInboundService, 'ingestInboundEvent'>
  > = {
    ingestInboundEvent: jest.fn(),
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
    service = new MailboxSyncService(
      mailboxRepo,
      mailboxInboundServiceMock as unknown as MailboxInboundService,
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
        inboundSyncCursor: 'cursor-2',
        inboundSyncLastPolledAt: expect.any(Date),
        inboundSyncLastError: null,
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
      } as Mailbox),
    ).rejects.toBeDefined();
    expect(mailboxRepo.update).toHaveBeenCalledWith(
      { id: 'mailbox-1' },
      expect.objectContaining({
        inboundSyncLastPolledAt: expect.any(Date),
        inboundSyncLastError: expect.stringContaining('status=504'),
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
});
