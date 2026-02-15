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
    delete process.env.MAILZEN_MAIL_ADMIN_API_TOKEN;
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
    mockedAxios.post.mockRejectedValue(new Error('network failure'));
    mailboxRepo.update.mockResolvedValue({ affected: 1 });
    const service = new MailServerService(
      mailboxRepo as unknown as Repository<Mailbox>,
    );

    await expect(service.provisionMailbox('user-1', 'sales')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(mailboxRepo.update).not.toHaveBeenCalled();
  });
});
