/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { MailboxService } from './mailbox.service';

describe('MailboxService', () => {
  const mailboxRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };
  const mailboxInboundEventRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
  };
  const mailServer = {
    provisionMailbox: jest.fn(),
  };
  const billingService = {
    getEntitlements: jest.fn().mockResolvedValue({
      planCode: 'PRO',
      providerLimit: 5,
      mailboxLimit: 5,
      workspaceLimit: 5,
      aiCreditsPerMonth: 500,
    }),
  };
  const workspaceService = {
    listMyWorkspaces: jest.fn().mockResolvedValue([
      {
        id: 'workspace-1',
        isPersonal: true,
      },
    ]),
  };

  const service = new MailboxService(
    mailboxRepo as any,
    userRepo as any,
    mailboxInboundEventRepo as any,
    mailServer as any,
    billingService as any,
    workspaceService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mailboxRepo.count.mockResolvedValue(0);
    mailboxInboundEventRepo.find.mockResolvedValue([]);
    mailboxInboundEventRepo.findOne.mockResolvedValue(null);
    mailboxInboundEventRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    billingService.getEntitlements.mockResolvedValue({
      planCode: 'PRO',
      providerLimit: 5,
      mailboxLimit: 5,
      workspaceLimit: 5,
      aiCreditsPerMonth: 500,
    });
  });

  it('rejects invalid desired local part', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.createMailbox('user-1', 'Invalid..Handle?'),
    ).rejects.toThrow(BadRequestException);
    expect(mailboxRepo.save).not.toHaveBeenCalled();
  });

  it('rejects already taken desired local part', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    mailboxRepo.findOne.mockResolvedValue({ id: 'existing-box' });

    await expect(service.createMailbox('user-1', 'sales')).rejects.toThrow(
      ConflictException,
    );
    expect(mailboxRepo.save).not.toHaveBeenCalled();
  });

  it('rejects mailbox creation when entitlement limit is reached', async () => {
    mailboxRepo.count.mockResolvedValue(5);
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });

    await expect(service.createMailbox('user-1', 'sales')).rejects.toThrow(
      BadRequestException,
    );
    expect(mailboxRepo.save).not.toHaveBeenCalled();
  });

  it('creates mailbox for available desired local part', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1' });
    mailboxRepo.findOne.mockResolvedValue(null);
    mailboxRepo.create.mockImplementation((data) => data);
    mailboxRepo.save.mockResolvedValue({
      id: 'mailbox-1',
      email: 'sales@mailzen.com',
    });
    mailServer.provisionMailbox.mockResolvedValue(undefined);

    const result = await service.createMailbox('user-1', 'sales');

    expect(mailboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        localPart: 'sales',
        domain: 'mailzen.com',
        email: 'sales@mailzen.com',
      }),
    );
    expect(mailServer.provisionMailbox).toHaveBeenCalledWith('user-1', 'sales');
    expect(result).toEqual({ id: 'mailbox-1', email: 'sales@mailzen.com' });
  });

  it('returns mailbox inbound events with mailbox email mapping', async () => {
    mailboxInboundEventRepo.find.mockResolvedValue([
      {
        id: 'event-1',
        mailboxId: 'mailbox-1',
        messageId: '<msg-1@example.com>',
        emailId: 'email-1',
        inboundThreadKey: 'thread-1',
        status: 'ACCEPTED',
        sourceIp: '198.51.100.10',
        signatureValidated: true,
        errorReason: null,
        createdAt: new Date('2026-02-15T12:00:00.000Z'),
      },
    ]);
    mailboxRepo.find.mockResolvedValue([
      { id: 'mailbox-1', email: 'sales@mailzen.com' },
    ]);

    const events = await service.getInboundEvents('user-1', { limit: 10 });

    expect(mailboxInboundEventRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 10,
      }),
    );
    expect(events).toEqual([
      expect.objectContaining({
        id: 'event-1',
        mailboxId: 'mailbox-1',
        mailboxEmail: 'sales@mailzen.com',
        status: 'ACCEPTED',
      }),
    ]);
  });

  it('rejects inbound event query with invalid status filter', async () => {
    await expect(
      service.getInboundEvents('user-1', { status: 'invalid-status' }),
    ).rejects.toThrow(BadRequestException);
    expect(mailboxInboundEventRepo.find).not.toHaveBeenCalled();
  });

  it('returns inbound event stats scoped to requested window', async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: 'ACCEPTED', count: '4' },
        { status: 'DEDUPLICATED', count: '1' },
        { status: 'REJECTED', count: '2' },
      ]),
    };
    mailboxInboundEventRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    mailboxInboundEventRepo.findOne.mockResolvedValue({
      createdAt: new Date('2026-02-15T13:00:00.000Z'),
    });

    const stats = await service.getInboundEventStats('user-1', {
      windowHours: 12,
    });

    expect(mailboxInboundEventRepo.createQueryBuilder).toHaveBeenCalledWith(
      'event',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'event.createdAt >= :windowStart',
      expect.objectContaining({ windowStart: expect.any(String) }),
    );
    expect(stats).toEqual({
      mailboxId: null,
      mailboxEmail: null,
      windowHours: 12,
      totalCount: 7,
      acceptedCount: 4,
      deduplicatedCount: 1,
      rejectedCount: 2,
      lastProcessedAt: new Date('2026-02-15T13:00:00.000Z'),
    });
  });
});
