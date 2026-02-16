/* eslint-disable @typescript-eslint/unbound-method */
import { InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { Repository } from 'typeorm';
import { Mailbox } from './entities/mailbox.entity';
import { MailServerService } from './mail-server.service';

jest.mock('axios');

describe('MailServerService', () => {
  const mailboxRepo: {
    update: jest.Mock;
  } = {
    update: jest.fn(),
  };

  const mockedAxios = axios as jest.Mocked<typeof axios>;

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SECRETS_KEY = 'abcdefghijklmnopqrstuvwxyz123456';
    delete process.env.MAILZEN_MAIL_ADMIN_API_URL;
    delete process.env.MAILZEN_MAIL_ADMIN_API_URLS;
    delete process.env.MAILZEN_MAIL_ADMIN_API_TOKEN;
    delete process.env.MAILZEN_MAIL_ADMIN_PROVIDER;
    delete process.env.MAILZEN_MAIL_ADMIN_REQUIRED;
    delete process.env.MAILZEN_MAIL_ADMIN_API_TIMEOUT_MS;
    delete process.env.MAILZEN_MAIL_ADMIN_API_RETRIES;
    delete process.env.MAILZEN_MAIL_ADMIN_API_RETRY_BACKOFF_MS;
    delete process.env.MAILZEN_MAIL_ADMIN_API_RETRY_JITTER_MS;
    delete process.env.MAILZEN_MAIL_ADMIN_MAILCOW_QUOTA_MB;
    delete process.env.MAILZEN_MAIL_ADMIN_API_TOKEN_HEADER;
    mockedAxios.isAxiosError.mockImplementation((value: unknown) =>
      Boolean((value as { isAxiosError?: boolean } | null)?.isAxiosError),
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('stores encrypted mailbox credentials when external API is disabled', async () => {
    mailboxRepo.update.mockResolvedValue({ affected: 1 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await service.provisionMailbox('user-1', 'sales');

    expect(mailboxRepo.update).toHaveBeenCalled();
    const [whereInput, updateInput] = mailboxRepo.update.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];

    expect(whereInput).toEqual({
      userId: 'user-1',
      localPart: 'sales',
      domain: 'mailzen.com',
    });
    expect(updateInput.username).toBe('sales@mailzen.com');
    expect(updateInput.passwordEnc).toEqual(expect.stringMatching(/^enc:v2:/));
    expect(updateInput.passwordIv).toBeUndefined();
  });

  it('fails provisioning when external admin API is required but not configured', async () => {
    process.env.MAILZEN_MAIL_ADMIN_REQUIRED = 'true';
    mailboxRepo.update.mockResolvedValue({ affected: 1 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await expect(service.provisionMailbox('user-1', 'sales')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mailboxRepo.update).not.toHaveBeenCalled();
  });

  it('defaults to strict provisioning in production when env flag is unset', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MAILZEN_MAIL_ADMIN_REQUIRED;
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await expect(service.provisionMailbox('user-1', 'sales')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mailboxRepo.update).not.toHaveBeenCalled();
  });

  it('returns provisioning health snapshot with endpoint normalization', () => {
    process.env.MAILZEN_MAIL_ADMIN_API_URLS =
      'https://mail-admin-a.local/, https://mail-admin-a.local, https://mail-admin-b.local//';
    process.env.MAILZEN_MAIL_ADMIN_PROVIDER = 'MAILCOW';
    process.env.MAILZEN_MAIL_ADMIN_REQUIRED = 'true';
    process.env.MAILZEN_MAIL_ADMIN_API_TIMEOUT_MS = '7200';
    process.env.MAILZEN_MAIL_ADMIN_API_RETRIES = '4';
    process.env.MAILZEN_MAIL_ADMIN_API_RETRY_BACKOFF_MS = '450';
    process.env.MAILZEN_MAIL_ADMIN_API_RETRY_JITTER_MS = '200';
    process.env.MAILZEN_MAIL_ADMIN_MAILCOW_QUOTA_MB = '64000';
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    const snapshot = service.getProvisioningHealthSnapshot();

    expect(snapshot.provider).toBe('MAILCOW');
    expect(snapshot.provisioningRequired).toBe(true);
    expect(snapshot.adminApiConfigured).toBe(true);
    expect(snapshot.configuredEndpointCount).toBe(2);
    expect(snapshot.configuredEndpoints).toEqual([
      'https://mail-admin-a.local',
      'https://mail-admin-b.local',
    ]);
    expect(snapshot.failoverEnabled).toBe(true);
    expect(snapshot.requestTimeoutMs).toBe(7200);
    expect(snapshot.maxRetries).toBe(4);
    expect(snapshot.retryBackoffMs).toBe(450);
    expect(snapshot.retryJitterMs).toBe(200);
    expect(snapshot.mailcowQuotaDefaultMb).toBe(64000);
    expect(snapshot.evaluatedAtIso).toEqual(expect.any(String));
  });

  it('throws when mailbox row cannot be updated', async () => {
    mailboxRepo.update.mockResolvedValue({ affected: 0 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await expect(service.provisionMailbox('user-1', 'sales')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('fails provisioning when external API call fails', async () => {
    process.env.MAILZEN_MAIL_ADMIN_API_URL = 'https://mail-admin.local';
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      message: 'network failure',
      response: {
        status: 503,
      },
      code: 'ECONNABORTED',
    });
    mailboxRepo.update.mockResolvedValue({ affected: 1 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await expect(service.provisionMailbox('user-1', 'sales')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mailboxRepo.update).not.toHaveBeenCalled();
  });

  it('retries recoverable external provisioning failures and succeeds', async () => {
    process.env.MAILZEN_MAIL_ADMIN_API_URL = 'https://mail-admin.local';
    process.env.MAILZEN_MAIL_ADMIN_API_RETRIES = '2';
    process.env.MAILZEN_MAIL_ADMIN_API_RETRY_BACKOFF_MS = '1';
    process.env.MAILZEN_MAIL_ADMIN_API_RETRY_JITTER_MS = '0';
    mockedAxios.post
      .mockRejectedValueOnce({
        isAxiosError: true,
        message: 'gateway timeout',
        response: {
          status: 504,
        },
      })
      .mockResolvedValueOnce({ data: { ok: true } } as never);
    mailboxRepo.update.mockResolvedValue({ affected: 1 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await service.provisionMailbox('user-1', 'sales');

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(mailboxRepo.update).toHaveBeenCalledTimes(1);
  });

  it('fails over across configured admin endpoints before retrying attempts', async () => {
    process.env.MAILZEN_MAIL_ADMIN_API_URLS =
      'https://mail-admin-a.local, https://mail-admin-b.local';
    process.env.MAILZEN_MAIL_ADMIN_API_RETRIES = '0';
    mockedAxios.post
      .mockRejectedValueOnce({
        isAxiosError: true,
        message: 'service unavailable',
        response: {
          status: 503,
        },
      })
      .mockResolvedValueOnce({ data: { ok: true } } as never);
    mailboxRepo.update.mockResolvedValue({ affected: 1 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await service.provisionMailbox('user-1', 'sales');

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^https:\/\/mail-admin-a\.local\/mailboxes$/),
      expect.any(Object),
      expect.any(Object),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^https:\/\/mail-admin-b\.local\/mailboxes$/),
      expect.any(Object),
      expect.any(Object),
    );
    expect(mailboxRepo.update).toHaveBeenCalledTimes(1);
  });

  it('passes entitlement mailbox quota to mailcow provisioning payload', async () => {
    process.env.MAILZEN_MAIL_ADMIN_API_URL = 'https://mail-admin.local';
    process.env.MAILZEN_MAIL_ADMIN_PROVIDER = 'MAILCOW';
    mockedAxios.post.mockResolvedValue({ data: { ok: true } } as never);
    mailboxRepo.update.mockResolvedValue({ affected: 1 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await service.provisionMailbox('user-1', 'sales', 4096);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/mail-admin\.local\/api\/v1\/add\/mailbox$/,
      ),
      expect.objectContaining({
        quota: 4096,
      }),
      expect.any(Object),
    );
  });

  it('treats already-existing mailbox response as idempotent success', async () => {
    process.env.MAILZEN_MAIL_ADMIN_API_URL = 'https://mail-admin.local';
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { message: 'Mailbox already exists' },
      },
    });
    mailboxRepo.update.mockResolvedValue({ affected: 1 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await expect(service.provisionMailbox('user-1', 'sales')).resolves.toBe(
      undefined,
    );
    expect(mailboxRepo.update).toHaveBeenCalledTimes(1);
  });

  it('attempts external rollback when credential persistence fails', async () => {
    process.env.MAILZEN_MAIL_ADMIN_API_URL = 'https://mail-admin.local';
    mockedAxios.post.mockResolvedValue({ data: { ok: true } } as never);
    mockedAxios.delete.mockResolvedValue({ data: { ok: true } } as never);
    mailboxRepo.update.mockResolvedValue({ affected: 0 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await expect(service.provisionMailbox('user-1', 'sales')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mockedAxios.delete).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/mail-admin\.local\/mailboxes\/sales%40mailzen\.com$/,
      ),
      expect.any(Object),
    );
  });

  it('fails over rollback calls across configured admin endpoints', async () => {
    process.env.MAILZEN_MAIL_ADMIN_API_URLS =
      'https://mail-admin-a.local, https://mail-admin-b.local';
    mockedAxios.post.mockResolvedValue({ data: { ok: true } } as never);
    mockedAxios.delete
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 500,
        },
      })
      .mockResolvedValueOnce({ data: { ok: true } } as never);
    mailboxRepo.update.mockResolvedValue({ affected: 0 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await expect(service.provisionMailbox('user-1', 'sales')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mockedAxios.delete).toHaveBeenCalledTimes(2);
    expect(mockedAxios.delete).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(
        /^https:\/\/mail-admin-a\.local\/mailboxes\/sales%40mailzen\.com$/,
      ),
      expect.any(Object),
    );
    expect(mockedAxios.delete).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /^https:\/\/mail-admin-b\.local\/mailboxes\/sales%40mailzen\.com$/,
      ),
      expect.any(Object),
    );
  });
});
