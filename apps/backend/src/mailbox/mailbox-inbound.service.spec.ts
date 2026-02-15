/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository, UpdateResult } from 'typeorm';
import { Email } from '../email/entities/email.entity';
import { UserNotification } from '../notification/entities/user-notification.entity';
import { NotificationService } from '../notification/notification.service';
import { Mailbox } from './entities/mailbox.entity';
import { MailboxInboundService } from './mailbox-inbound.service';

describe('MailboxInboundService', () => {
  let service: MailboxInboundService;
  let mailboxRepo: jest.Mocked<Repository<Mailbox>>;
  let emailRepo: jest.Mocked<Repository<Email>>;
  let notificationService: jest.Mocked<
    Pick<NotificationService, 'createNotification'>
  >;
  const envBackup = {
    inboundToken: process.env.MAILZEN_INBOUND_WEBHOOK_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.MAILZEN_INBOUND_WEBHOOK_TOKEN = 'test-inbound-token';
    process.env.NODE_ENV = 'test';

    mailboxRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Mailbox>>;
    emailRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Email>>;
    notificationService = {
      createNotification: jest.fn(),
    };

    service = new MailboxInboundService(
      mailboxRepo,
      emailRepo,
      notificationService as unknown as NotificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env.MAILZEN_INBOUND_WEBHOOK_TOKEN = envBackup.inboundToken;
    process.env.NODE_ENV = envBackup.nodeEnv;
  });

  it('ingests mailbox inbound payload and creates notification context', async () => {
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: '120',
      status: 'ACTIVE',
      quotaLimitMb: 51200,
    } as Mailbox);
    emailRepo.create.mockImplementation((payload) => payload as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-1',
      userId: 'user-1',
      subject: 'New lead',
      body: '<p>Hello</p>',
      from: 'lead@example.com',
      to: ['sales@mailzen.com'],
      status: 'NEW',
    } as Email);
    mailboxRepo.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    notificationService.createNotification.mockResolvedValue(
      {} as UserNotification,
    );

    const result = await service.ingestInboundEvent(
      {
        mailboxEmail: 'sales@mailzen.com',
        from: 'lead@example.com',
        subject: 'New lead',
        htmlBody: '<p>Hello</p>',
        messageId: '<msg-1@example.com>',
        sizeBytes: '200',
      },
      {
        inboundTokenHeader: 'test-inbound-token',
        sourceIp: '127.0.0.1',
      },
    );

    expect(emailRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        status: 'NEW',
      }),
    );
    expect(mailboxRepo.update).toHaveBeenCalledWith(
      { id: 'mailbox-1' },
      { usedBytes: '320' },
    );
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'MAILBOX_INBOUND',
        metadata: expect.objectContaining({
          mailboxId: 'mailbox-1',
          workspaceId: 'workspace-1',
          sizeBytes: '200',
          sourceIp: '127.0.0.1',
        }),
      }),
    );
    expect(result).toEqual({
      accepted: true,
      mailboxId: 'mailbox-1',
      mailboxEmail: 'sales@mailzen.com',
      emailId: 'email-1',
    });
  });

  it('rejects inbound payload when token is invalid', async () => {
    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'Hello',
        },
        { inboundTokenHeader: 'wrong-token' },
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(mailboxRepo.findOne).not.toHaveBeenCalled();
  });

  it('rejects inbound payload for unknown mailbox', async () => {
    mailboxRepo.findOne.mockResolvedValue(null);

    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'Hello',
        },
        { inboundTokenHeader: 'test-inbound-token' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects inbound payload when mailbox is suspended', async () => {
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: '120',
      status: 'SUSPENDED',
      quotaLimitMb: 51200,
    } as Mailbox);

    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'Hello',
        },
        { inboundTokenHeader: 'test-inbound-token' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(emailRepo.save).not.toHaveBeenCalled();
  });

  it('rejects inbound payload when mailbox quota is exceeded', async () => {
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: (2n * 1024n * 1024n - 1n).toString(),
      status: 'ACTIVE',
      quotaLimitMb: 2,
    } as Mailbox);

    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'This payload exceeds the remaining mailbox quota',
          sizeBytes: '2048',
        },
        { inboundTokenHeader: 'test-inbound-token' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(emailRepo.save).not.toHaveBeenCalled();
  });
});
