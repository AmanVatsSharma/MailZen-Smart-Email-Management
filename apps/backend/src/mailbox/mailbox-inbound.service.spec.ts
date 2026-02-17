/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { InsertResult, Repository, UpdateResult } from 'typeorm';
import { BillingService } from '../billing/billing.service';
import { Email } from '../email/entities/email.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { MailboxInboundEvent } from './entities/mailbox-inbound-event.entity';
import { Mailbox } from './entities/mailbox.entity';
import { MailboxInboundService } from './mailbox-inbound.service';

describe('MailboxInboundService', () => {
  let service: MailboxInboundService;
  let mailboxRepo: jest.Mocked<Repository<Mailbox>>;
  let emailRepo: jest.Mocked<Repository<Email>>;
  let mailboxInboundEventRepo: jest.Mocked<Repository<MailboxInboundEvent>>;
  let notificationEventBus: jest.Mocked<
    Pick<NotificationEventBusService, 'publishSafely'>
  >;
  let billingService: jest.Mocked<Pick<BillingService, 'getEntitlements'>>;
  const envBackup = {
    inboundToken: process.env.MAILZEN_INBOUND_WEBHOOK_TOKEN,
    signingKey: process.env.MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.MAILZEN_INBOUND_WEBHOOK_TOKEN = 'test-inbound-token';
    process.env.NODE_ENV = 'test';
    delete process.env.MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY;

    mailboxRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Mailbox>>;
    emailRepo = {
      create: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Email>>;
    mailboxInboundEventRepo = {
      findOne: jest.fn(),
      upsert: jest.fn(),
    } as unknown as jest.Mocked<Repository<MailboxInboundEvent>>;
    notificationEventBus = {
      publishSafely: jest.fn(),
    };
    billingService = {
      getEntitlements: jest.fn().mockResolvedValue({
        planCode: 'PRO',
        providerLimit: 5,
        mailboxLimit: 5,
        workspaceLimit: 5,
        workspaceMemberLimit: 25,
        aiCreditsPerMonth: 500,
        mailboxStorageLimitMb: 51200,
      }),
    };

    service = new MailboxInboundService(
      mailboxRepo,
      emailRepo,
      mailboxInboundEventRepo,
      notificationEventBus as unknown as NotificationEventBusService,
      billingService as unknown as BillingService,
    );

    emailRepo.findOne.mockResolvedValue(null);
    mailboxInboundEventRepo.findOne.mockResolvedValue(null);
    mailboxInboundEventRepo.upsert.mockResolvedValue({} as InsertResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env.MAILZEN_INBOUND_WEBHOOK_TOKEN = envBackup.inboundToken;
    process.env.MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY = envBackup.signingKey;
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
    notificationEventBus.publishSafely.mockResolvedValue(null);
    emailRepo.findOne.mockResolvedValue(null);

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
        mailboxId: 'mailbox-1',
        status: 'NEW',
      }),
    );
    expect(mailboxRepo.update).toHaveBeenCalledWith(
      { id: 'mailbox-1' },
      { usedBytes: '320' },
    );
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'MAILBOX_INBOUND',
        metadata: expect.objectContaining({
          mailboxId: 'mailbox-1',
          workspaceId: 'workspace-1',
          sizeBytes: '200',
          sourceIp: '127.0.0.1',
          inboundStatus: 'ACCEPTED',
        }),
      }),
    );
    expect(result).toEqual({
      accepted: true,
      mailboxId: 'mailbox-1',
      mailboxEmail: 'sales@mailzen.com',
      emailId: 'email-1',
      deduplicated: false,
    });
    expect(mailboxInboundEventRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        messageId: '<msg-1@example.com>',
        emailId: 'email-1',
        status: 'ACCEPTED',
      }),
      ['mailboxId', 'messageId'],
    );
  });

  it('rejects inbound payload when token is invalid', async () => {
    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'Hello',
          messageId: '<invalid-token@example.com>',
        },
        { inboundTokenHeader: 'wrong-token' },
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(mailboxRepo.findOne).not.toHaveBeenCalled();
    expect(mailboxInboundEventRepo.upsert).not.toHaveBeenCalled();
  });

  it('rejects inbound payload for unknown mailbox', async () => {
    mailboxRepo.findOne.mockResolvedValue(null);
    emailRepo.findOne.mockResolvedValue(null);

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
    expect(notificationEventBus.publishSafely).not.toHaveBeenCalled();
  });

  it('accepts trusted internal ingest when auth is skipped', async () => {
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: '120',
      status: 'ACTIVE',
      quotaLimitMb: 51200,
    } as Mailbox);
    emailRepo.findOne.mockResolvedValue(null);
    emailRepo.create.mockImplementation((payload) => payload as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-1',
      userId: 'user-1',
      mailboxId: 'mailbox-1',
      subject: 'Internal sync lead',
      body: '<p>Hello</p>',
      from: 'lead@example.com',
      to: ['sales@mailzen.com'],
      status: 'NEW',
    } as Email);
    mailboxRepo.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    notificationEventBus.publishSafely.mockResolvedValue(null);

    const result = await service.ingestInboundEvent(
      {
        mailboxEmail: 'sales@mailzen.com',
        from: 'lead@example.com',
        subject: 'Internal sync lead',
        htmlBody: '<p>Hello</p>',
        messageId: '<trusted-1@example.com>',
      },
      {
        inboundTokenHeader: 'wrong-token',
      },
      {
        skipAuth: true,
      },
    );

    expect(result.accepted).toBe(true);
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          inboundStatus: 'ACCEPTED',
          mailboxId: 'mailbox-1',
        }),
      }),
    );
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
    emailRepo.findOne.mockResolvedValue(null);

    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'Hello',
          messageId: '<suspended-mailbox@example.com>',
        },
        { inboundTokenHeader: 'test-inbound-token' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(emailRepo.save).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'MAILBOX_INBOUND',
        metadata: expect.objectContaining({
          mailboxId: 'mailbox-1',
          inboundStatus: 'REJECTED',
          messageId: '<suspended-mailbox@example.com>',
        }),
      }),
    );
    expect(mailboxInboundEventRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        messageId: '<suspended-mailbox@example.com>',
        status: 'REJECTED',
      }),
      ['mailboxId', 'messageId'],
    );
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
    emailRepo.findOne.mockResolvedValue(null);

    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'This payload exceeds the remaining mailbox quota',
          messageId: '<quota-exceeded@example.com>',
          sizeBytes: '2048',
        },
        { inboundTokenHeader: 'test-inbound-token' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(emailRepo.save).not.toHaveBeenCalled();
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'MAILBOX_INBOUND',
        metadata: expect.objectContaining({
          mailboxId: 'mailbox-1',
          inboundStatus: 'REJECTED',
          messageId: '<quota-exceeded@example.com>',
        }),
      }),
    );
    expect(mailboxInboundEventRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        messageId: '<quota-exceeded@example.com>',
        status: 'REJECTED',
      }),
      ['mailboxId', 'messageId'],
    );
  });

  it('rejects inbound payload when entitlement mailbox storage limit is exceeded', async () => {
    billingService.getEntitlements.mockResolvedValue({
      planCode: 'FREE',
      providerLimit: 1,
      mailboxLimit: 1,
      workspaceLimit: 1,
      workspaceMemberLimit: 3,
      aiCreditsPerMonth: 50,
      mailboxStorageLimitMb: 1,
    });
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: (1n * 1024n * 1024n - 1n).toString(),
      status: 'ACTIVE',
      quotaLimitMb: 51200,
    } as Mailbox);
    emailRepo.findOne.mockResolvedValue(null);

    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'Message that exceeds entitled storage',
          messageId: '<entitlement-quota-exceeded@example.com>',
          sizeBytes: '2048',
        },
        { inboundTokenHeader: 'test-inbound-token' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(emailRepo.save).not.toHaveBeenCalled();
    expect(mailboxInboundEventRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        userId: 'user-1',
        messageId: '<entitlement-quota-exceeded@example.com>',
        status: 'REJECTED',
      }),
      ['mailboxId', 'messageId'],
    );
  });

  it('deduplicates repeated inbound events by messageId in cache window', async () => {
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: '120',
      status: 'ACTIVE',
      quotaLimitMb: 51200,
    } as Mailbox);
    emailRepo.findOne.mockResolvedValue(null);
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
    notificationEventBus.publishSafely.mockResolvedValue(null);

    await service.ingestInboundEvent(
      {
        mailboxEmail: 'sales@mailzen.com',
        from: 'lead@example.com',
        subject: 'New lead',
        htmlBody: '<p>Hello</p>',
        messageId: '<msg-dedupe@example.com>',
      },
      { inboundTokenHeader: 'test-inbound-token' },
    );

    const duplicateResult = await service.ingestInboundEvent(
      {
        mailboxEmail: 'sales@mailzen.com',
        from: 'lead@example.com',
        subject: 'New lead',
        htmlBody: '<p>Hello</p>',
        messageId: '<msg-dedupe@example.com>',
      },
      { inboundTokenHeader: 'test-inbound-token' },
    );

    expect(emailRepo.save).toHaveBeenCalledTimes(1);
    expect(mailboxRepo.update).toHaveBeenCalledTimes(1);
    expect(notificationEventBus.publishSafely).toHaveBeenCalledTimes(2);
    expect(notificationEventBus.publishSafely).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'MAILBOX_INBOUND',
        metadata: expect.objectContaining({
          inboundStatus: 'DEDUPLICATED',
          messageId: '<msg-dedupe@example.com>',
        }),
      }),
    );
    expect(mailboxInboundEventRepo.upsert).toHaveBeenCalledTimes(2);
    expect(duplicateResult).toMatchObject({
      accepted: true,
      deduplicated: true,
      emailId: 'email-1',
    });
  });

  it('rejects inbound payload when signature is configured but invalid', async () => {
    process.env.MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY = 'signing-secret';

    await expect(
      service.ingestInboundEvent(
        {
          mailboxEmail: 'sales@mailzen.com',
          from: 'lead@example.com',
          subject: 'New lead',
          textBody: 'Hello',
        },
        {
          inboundTokenHeader: 'test-inbound-token',
          timestampHeader: Date.now().toString(),
          signatureHeader: 'invalid-signature',
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts inbound payload when signature is valid', async () => {
    const signingKey = 'signing-secret';
    process.env.MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY = signingKey;

    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: '120',
      status: 'ACTIVE',
      quotaLimitMb: 51200,
    } as Mailbox);
    emailRepo.findOne.mockResolvedValue(null);
    emailRepo.create.mockImplementation((payload) => payload as Email);
    emailRepo.save.mockResolvedValue({
      id: 'email-2',
      userId: 'user-1',
      subject: 'Signed lead',
      body: 'Hello',
      from: 'lead@example.com',
      to: ['sales@mailzen.com'],
      status: 'NEW',
    } as Email);
    mailboxRepo.update.mockResolvedValue({ affected: 1 } as UpdateResult);
    notificationEventBus.publishSafely.mockResolvedValue(null);

    const timestamp = Date.now();
    const payloadDigest = [
      'sales@mailzen.com',
      'lead@example.com',
      '<signed-message@example.com>',
      'Signed lead',
    ].join('.');
    const signature = createHmac('sha256', signingKey)
      .update(`${timestamp}.${payloadDigest}`)
      .digest('hex');

    const result = await service.ingestInboundEvent(
      {
        mailboxEmail: 'sales@mailzen.com',
        from: 'lead@example.com',
        subject: 'Signed lead',
        textBody: 'Hello',
        messageId: '<signed-message@example.com>',
      },
      {
        inboundTokenHeader: 'test-inbound-token',
        timestampHeader: timestamp.toString(),
        signatureHeader: signature,
      },
    );

    expect(result.accepted).toBe(true);
    expect(result.emailId).toBe('email-2');
    expect(mailboxInboundEventRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: '<signed-message@example.com>',
        status: 'ACCEPTED',
        signatureValidated: true,
      }),
      ['mailboxId', 'messageId'],
    );
  });

  it('deduplicates using persisted inbound-event store before email lookup', async () => {
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: '120',
      status: 'ACTIVE',
      quotaLimitMb: 51200,
    } as Mailbox);
    mailboxInboundEventRepo.findOne.mockResolvedValue({
      id: 'event-1',
      mailboxId: 'mailbox-1',
      userId: 'user-1',
      messageId: '<persisted-event@example.com>',
      emailId: 'email-existing-77',
      status: 'ACCEPTED',
    } as MailboxInboundEvent);

    const result = await service.ingestInboundEvent(
      {
        mailboxEmail: 'sales@mailzen.com',
        from: 'lead@example.com',
        subject: 'New lead',
        textBody: 'Hello',
        messageId: '<persisted-event@example.com>',
      },
      { inboundTokenHeader: 'test-inbound-token' },
    );

    expect(emailRepo.save).not.toHaveBeenCalled();
    expect(emailRepo.findOne).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      accepted: true,
      deduplicated: true,
      emailId: 'email-existing-77',
    });
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MAILBOX_INBOUND',
        metadata: expect.objectContaining({
          inboundStatus: 'DEDUPLICATED',
          messageId: '<persisted-event@example.com>',
        }),
      }),
    );
  });

  it('deduplicates by persisted inbound message id across cache misses', async () => {
    mailboxRepo.findOne.mockResolvedValue({
      id: 'mailbox-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      email: 'sales@mailzen.com',
      usedBytes: '120',
      status: 'ACTIVE',
      quotaLimitMb: 51200,
    } as Mailbox);
    emailRepo.findOne.mockResolvedValue({
      id: 'existing-email-1',
      userId: 'user-1',
      inboundMessageId: '<persisted@example.com>',
    } as Email);

    const result = await service.ingestInboundEvent(
      {
        mailboxEmail: 'sales@mailzen.com',
        from: 'lead@example.com',
        subject: 'New lead',
        textBody: 'Hello',
        messageId: '<persisted@example.com>',
      },
      { inboundTokenHeader: 'test-inbound-token' },
    );

    expect(emailRepo.save).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      accepted: true,
      deduplicated: true,
      emailId: 'existing-email-1',
    });
    expect(notificationEventBus.publishSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MAILBOX_INBOUND',
        metadata: expect.objectContaining({
          inboundStatus: 'DEDUPLICATED',
          messageId: '<persisted@example.com>',
        }),
      }),
    );
    expect(mailboxInboundEventRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        mailboxId: 'mailbox-1',
        messageId: '<persisted@example.com>',
        emailId: 'existing-email-1',
        status: 'DEDUPLICATED',
      }),
      ['mailboxId', 'messageId'],
    );
  });
});
